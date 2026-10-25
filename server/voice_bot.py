"""Margaret on the phone: Twilio → Cartesia STT → Gemini → Cartesia TTS, via Pipecat.

This runs as its own process next to the dashboard server. Every caller line goes
to ScamWatch through the same HTTP endpoints the text simulator uses, so the
phone and the simulator share one tested code path.

Run (after `uvicorn server.main:app --port 8000` is up):
  Phone:   ngrok http --url=<your-ngrok-domain> 7860
           .venv/Scripts/python server/voice_bot.py -t twilio -x <your-ngrok-domain>
           Twilio number → Voice webhook (POST) → https://<your-ngrok-domain>/
  Browser: .venv/Scripts/python server/voice_bot.py -t webrtc   then open http://localhost:7860/client
"""
import asyncio
import os
import random
import sys
import time
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from loguru import logger

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

from pipecat.audio.vad.silero import SileroVADAnalyzer  # noqa: E402
from pipecat.audio.vad.vad_analyzer import VADParams  # noqa: E402
from pipecat.frames.frames import (BotStartedSpeakingFrame, BotStoppedSpeakingFrame,  # noqa: E402
                                   EndTaskFrame, InterimTranscriptionFrame, InterruptionFrame,
                                   LLMFullResponseEndFrame, LLMTextFrame, TranscriptionFrame, TTSSpeakFrame)
from pipecat.pipeline.llm_switcher import LLMSwitcher  # noqa: E402
from pipecat.pipeline.pipeline import Pipeline  # noqa: E402
from pipecat.pipeline.service_switcher import ServiceSwitcherStrategyFailover  # noqa: E402
from pipecat.pipeline.worker import PipelineParams, PipelineWorker  # noqa: E402
from pipecat.processors.aggregators.llm_context import LLMContext  # noqa: E402
from pipecat.processors.aggregators.llm_response_universal import (LLMContextAggregatorPair,  # noqa: E402
                                                                   LLMUserAggregatorParams)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor  # noqa: E402
from pipecat.runner.types import RunnerArguments  # noqa: E402
from pipecat.runner.utils import create_transport  # noqa: E402
from pipecat.services.cartesia.stt import CartesiaSTTService  # noqa: E402
from pipecat.services.cartesia.tts import CartesiaTTSService  # noqa: E402
from pipecat.services.google.llm import GoogleLLMService  # noqa: E402
from pipecat.services.openai.llm import OpenAILLMService  # noqa: E402
from pipecat.transports.base_transport import TransportParams  # noqa: E402
from pipecat.utils.text.markdown_text_filter import MarkdownTextFilter  # noqa: E402
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams  # noqa: E402
from pipecat.turns.user_start import MinWordsUserTurnStartStrategy  # noqa: E402
from pipecat.turns.user_turn_strategies import UserTurnStrategies  # noqa: E402
from pipecat.utils.errors import ErrorCategory  # noqa: E402
from pipecat.workers.runner import WorkerRunner  # noqa: E402

from server.persona import FIRST_LINE, SYSTEM_PROMPT, coach  # noqa: E402

API = os.getenv("DASHBOARD_API", "http://127.0.0.1:8000")
# A warm, older-sounding stock voice. Override with CARTESIA_VOICE_ID in .env.
DEFAULT_VOICE = "71a7ad14-091c-4e8e-a314-022ece01c121"
# gemini-2.5-flash is closed to new API keys; 3.5-flash-lite had the fastest first token (~1.3 s) on the free tier.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
# Backup brain if Gemini hits a quota or outage mid-call. OpenAI-compatible API; the key only works on the .ai host.
STEPFUN_MODEL = os.getenv("STEPFUN_MODEL", "step-3.7-flash")
STEPFUN_URL = "https://api.stepfun.ai/v1"
FAILOVER_ON = {ErrorCategory.RATE_LIMIT, ErrorCategory.QUOTA, ErrorCategory.SERVER}


def make_llm(brain: str = "gemini"):
    """The brain picked on the dashboard first, with the others taking over for the rest of the call
    if it stops answering. Default: Gemini, then StepFun."""
    # Short replies keep each turn fast.
    llms = {"gemini": GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        settings=GoogleLLMService.Settings(model=GEMINI_MODEL, system_instruction=SYSTEM_PROMPT, max_tokens=120),
    )}
    if os.getenv("STEPFUN_API_KEY"):
        llms["stepfun"] = OpenAILLMService(
            api_key=os.getenv("STEPFUN_API_KEY"), base_url=STEPFUN_URL,
            settings=OpenAILLMService.Settings(model=STEPFUN_MODEL, system_instruction=SYSTEM_PROMPT, max_tokens=120),
        )
    if os.getenv("OWN_LLM_URL"):  # our fine-tuned Margaret on Vultr (demo/option_c_own_margaret_llm_prompt.md)
        llms["own"] = OpenAILLMService(
            api_key=os.getenv("OWN_LLM_KEY", "none"), base_url=os.getenv("OWN_LLM_URL"),
            settings=OpenAILLMService.Settings(model=os.getenv("OWN_LLM_MODEL", "margaret"),
                                               system_instruction=SYSTEM_PROMPT, max_tokens=120),
        )
    order = [llms.pop(brain)] if brain in llms else []
    order += list(llms.values())
    if len(order) == 1:
        return order[0]

    # Pipecat only fails over on permanent errors (bad key); a 429 or 5xx counts too here.
    for svc in order[:-1]:
        @svc.event_handler("on_error")
        async def on_llm_error(service, error):
            if error.category in FAILOVER_ON:
                await service.set_usable(False)

    logger.info(f"Margaret's brain: {[s.name for s in order]}")
    switcher = LLMSwitcher(llms=order, strategy_type=ServiceSwitcherStrategyFailover)

    @switcher.strategy.event_handler("on_service_switched")
    async def on_switched(strategy, service):
        logger.warning(f"LLM failover: Margaret is now running on {service.name}")

    return switcher


class Dashboard:
    """Tiny async client for the dashboard server."""

    def __init__(self):
        self.http = aiohttp.ClientSession(base_url=API, timeout=aiohttp.ClientTimeout(total=3))

    async def post(self, path: str, body: dict | None = None) -> dict:
        try:
            async with self.http.post(path, json=body or {}) as r:
                return await r.json()
        except Exception as e:  # never let the dashboard break the call
            logger.warning(f"dashboard {path} failed: {e}")
            return {}

    async def close(self):
        await self.http.close()


class CallerTap(FrameProcessor):
    """Sends caller speech to ScamWatch and adds the live coaching note before the LLM sees it."""

    def __init__(self, dash: Dashboard):
        super().__init__()
        self.dash = dash
        self.wrap_up = False

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InterimTranscriptionFrame):
            asyncio.create_task(self.dash.post("/api/sim/utterance", {"speaker": "caller", "text": frame.text, "final": False}))
        elif isinstance(frame, TranscriptionFrame) and frame.text.strip():
            r = await self.dash.post("/api/sim/utterance", {"speaker": "caller", "text": frame.text})
            if r.get("strategy"):
                self.wrap_up = "goodbye" in r["strategy"].lower()
                frame.text = frame.text + coach(r["strategy"])
        await self.push_frame(frame, direction)


INTERRUPTED_FILLERS = ["Oh—", "Mm?", "Oh, sorry—", "Oh dear—", "Hm?"]


class MargaretTap(FrameProcessor):
    """Collects each Margaret reply for the dashboard, reacts like a person when cut off, and hangs up
    only once her goodbye has actually finished playing."""

    def __init__(self, dash: Dashboard, caller_tap: CallerTap):
        super().__init__()
        self.dash = dash
        self.caller_tap = caller_tap
        self.buf = ""
        self.speaking = False
        self.last_filler = 0.0
        self.hangup_pending = False

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, BotStartedSpeakingFrame):
            self.speaking = True
        elif isinstance(frame, BotStoppedSpeakingFrame):
            self.speaking = False
            if self.hangup_pending:
                self.hangup_pending = False
                asyncio.create_task(self._hang_up(1.2))  # a beat of silence after "goodbye", like a person
        elif isinstance(frame, InterruptionFrame):
            was_speaking, line, self.buf = self.speaking, self.buf.strip(), ""
            if line:
                await self.dash.post("/api/sim/utterance", {"speaker": "margaret", "text": line + "—"})
            await self.push_frame(frame, direction)
            # Instead of going dead silent mid-word, a short "oh—" and then she listens.
            if was_speaking and time.monotonic() - self.last_filler > 4:
                self.last_filler = time.monotonic()
                await self.push_frame(TTSSpeakFrame(random.choice(INTERRUPTED_FILLERS)), FrameDirection.DOWNSTREAM)
            return
        elif isinstance(frame, LLMTextFrame):
            self.buf += frame.text
        elif isinstance(frame, LLMFullResponseEndFrame) and self.buf.strip():
            line, self.buf = self.buf.strip(), ""
            await self.dash.post("/api/sim/utterance", {"speaker": "margaret", "text": line})
            if self.caller_tap.wrap_up and "bye" in line.lower():
                self.hangup_pending = True
                asyncio.create_task(self._hang_up(15))  # backstop if the audio-stopped event never comes
        await self.push_frame(frame, direction)

    async def _hang_up(self, delay: float):
        await asyncio.sleep(delay)
        await self.push_frame(EndTaskFrame(), FrameDirection.UPSTREAM)


async def run_bot(transport, runner_args: RunnerArguments, phone: bool):
    dash = Dashboard()
    try:  # the brain chosen on the dashboard; the dashboard being down must not stop the call
        async with dash.http.get("/api/settings") as r:
            brain = (await r.json()).get("brain", "gemini")
    except Exception:
        brain = "gemini"
    llm = make_llm(brain)
    stt = CartesiaSTTService(api_key=os.getenv("CARTESIA_API_KEY"))
    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        settings=CartesiaTTSService.Settings(voice=os.getenv("CARTESIA_VOICE_ID") or DEFAULT_VOICE),
        # Gemini sometimes wraps digits in *asterisks*; strip markdown so it's never spoken.
        text_filters=[MarkdownTextFilter()],
    )

    context = LLMContext()
    user_agg, assistant_agg = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            # Margaret answers ~0.3 s after the caller stops, not the ~0.8 s default.
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.3)),
            # While she talks, only 3+ real words cut her off, so breaths, "mm-hmm" and speakerphone echo don't.
            user_turn_strategies=UserTurnStrategies(start=[MinWordsUserTurnStartStrategy(min_words=3)]),
        ),
    )
    caller_tap = CallerTap(dash)
    margaret_tap = MargaretTap(dash, caller_tap)

    pipeline = Pipeline([
        transport.input(), stt, caller_tap, user_agg, llm, margaret_tap, tts, transport.output(), assistant_agg,
    ])
    worker = PipelineWorker(
        pipeline,
        # Phone audio is 8 kHz; matching it avoids resampling. The browser uses defaults.
        params=PipelineParams(audio_in_sample_rate=8000, audio_out_sample_rate=8000, enable_metrics=True)
        if phone else PipelineParams(enable_metrics=True),
        idle_timeout_secs=runner_args.pipeline_idle_timeout_secs,
    )
    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint, force_gc=True)
    await runner.add_workers(worker)

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        await dash.post("/api/call/start", {"source": "phone" if phone else "browser"})
        # Pick up instantly with a fixed line instead of waiting on the LLM.
        # The assistant aggregator records the spoken line in the context, so it isn't added here too.
        await dash.post("/api/sim/utterance", {"speaker": "margaret", "text": FIRST_LINE})
        await worker.queue_frames([TTSSpeakFrame(FIRST_LINE)])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        await dash.post("/api/sim/end")
        await dash.close()
        await runner.cancel()

    await runner.run()


async def bot(runner_args: RunnerArguments):
    transport = await create_transport(runner_args, {
        "twilio": lambda: FastAPIWebsocketParams(audio_in_enabled=True, audio_out_enabled=True),
        # Browser mic at http://localhost:7860/client: for testing without Twilio, and the no-phone fallback.
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    })
    await run_bot(transport, runner_args, phone=type(transport).__name__ == "FastAPIWebsocketTransport")


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
