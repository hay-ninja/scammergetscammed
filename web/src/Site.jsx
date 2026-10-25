import React, { useEffect, useState } from "react";
import { SCRIPTS } from "./scripts.js";

// The vendor side: Scammer Gets Scammed sells a decoy line + ScamWatch to banks.
// Bay Federal (the console at #/console) is the fictional bank customer using it.

const SOURCES = {
  ic3: "https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf",
  psa: "https://www.ic3.gov/PSA/2023/PSA230929",
  ftc: "https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf",
  ftcImp: "https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-impersonation-rule-goes-effect-today",
};

function useJson(url) {
  const [d, setD] = useState(null);
  useEffect(() => { fetch(url).then((r) => r.json()).then(setD).catch(() => setD({})); }, [url]);
  return d;
}

export function SiteNav({ route }) {
  const links = [["#/", "Product"], ["#/how", "Architecture"], ["#/api", "API & embed"], ["#/scripts", "Judge scripts"], ["#/console", "Live console"]];
  return (
    <nav className="bg-navy-950 text-white sticky top-0 z-20 print:hidden">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
        <a href="#/" className="flex items-center gap-2.5 font-bold tracking-tight text-[17px]">
          <span className="h-8 w-8 rounded-lg bg-red-600 grid place-items-center text-base" aria-hidden="true">☎</span>
          Scammer Gets Scammed
        </a>
        <div className="flex-1" />
        {links.map(([href, label]) => (
          <a key={href} href={href} className={`text-sm font-semibold ${route === href ? "text-white" : "text-white/60 hover:text-white"}`}>{label}</a>
        ))}
      </div>
    </nav>
  );
}

const Section = ({ eyebrow, title, children, className = "" }) => (
  <section className={`max-w-6xl mx-auto px-6 py-14 ${className}`}>
    {eyebrow && <div className="eyebrow text-red-600">{eyebrow}</div>}
    {title && <h2 className="text-[32px] font-bold tracking-tight text-ink-900 mt-2 mb-6 leading-tight">{title}</h2>}
    {children}
  </section>
);

const Stat = ({ value, label, href }) => (
  <div className="card p-6">
    <div className="text-[40px] font-bold tracking-tight text-ink-900 leading-none">{value}</div>
    <div className="text-ink-700 mt-3 text-[15px]">{label}</div>
    {href && <a href={href} target="_blank" rel="noreferrer" className="text-xs text-ink-400 underline mt-2 inline-block">source</a>}
  </div>
);

// ---------- landing ----------

export function Landing() {
  const m = useJson("/api/model");
  const b = useJson("/api/bench");
  const ho = m?.int8_call_level ? m.int8_heldout?.call_level : m?.heldout?.call_level;
  return (
    <div>
      <header className="bg-navy-950 text-white">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid grid-cols-12 gap-10 items-center">
          <div className="col-span-7">
            <div className="eyebrow text-red-400">Fraud operations · for banks and credit unions</div>
            <h1 className="text-[52px] font-bold tracking-tight leading-[1.05] mt-3">
              Every phantom-hacker scam ends with <span className="text-red-400">“move your money to a safe account.”</span>
            </h1>
            <p className="text-white/75 text-lg mt-6 leading-relaxed">
              We answer the scammers instead. Margaret, an AI decoy grandma, keeps them talking until they read out
              their “safe account.” Within seconds the bank blocklists it, holds every pending wire to it, and finds the
              customers who already paid it.
            </p>
            <div className="flex gap-3 mt-8">
              <a href="#/console" className="btn bg-red-600 text-white hover:bg-red-700 px-5 py-3 text-base">See a live call</a>
              <a href="#/how" className="btn bg-white/10 text-white hover:bg-white/20 px-5 py-3 text-base">How it works</a>
            </div>
          </div>
          <div className="col-span-5 rounded-2xl bg-white text-ink-900 p-6 shadow-2xl border-t-[6px] border-red-600">
            <div className="text-red-600 text-xs font-bold tracking-[0.2em]">MULE ACCOUNT BLOCKED</div>
            <div className="text-[52px] font-bold text-teal-600 leading-none mt-3">$49,500</div>
            <div className="text-ink-500 mt-2">protected or in recovery, from one 4-minute call</div>
            <div className="mt-5 space-y-2 text-sm">
              {[["Dorothy P., 81", "$8,500 wire", "Held"], ["Harold J., 79", "$26,000 · 9 days ago", "Recall"], ["June O., 83", "$15,000 · 4 days ago", "Recall"]].map(([n, a, s]) => (
                <div key={n} className="flex items-center justify-between border-t border-line pt-2">
                  <span className="font-semibold">{n}</span><span className="text-ink-500">{a}</span>
                  <span className={`pill ${s === "Held" ? "bg-teal-50 text-teal-600" : "bg-amber-50 text-amber-800"}`}>{s}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-ink-400 mt-4">Demo data: Bay Federal Credit Union is fictional.</div>
          </div>
        </div>
      </header>

      <Section eyebrow="The problem" title="Seniors lose more to fraud than any other age group, and the bank watches it happen.">
        <div className="grid grid-cols-4 gap-4">
          <Stat value="$4.9B" label="lost by Americans 60+ in 2024, up 43% in a year (FBI IC3)" href={SOURCES.ic3} />
          <Stat value="$33K" label="average reported loss per complaint from someone 60+ (IC3 2024: $4.885B ÷ 147,127)" href={SOURCES.ic3} />
          <Stat value="66%" label="of tech-support / phantom-hacker losses came from victims over 60 (FBI, H1 2023)" href={SOURCES.psa} />
          <Stat value="$2.09B" label="lost by bank transfer in 2024, the costliest way to pay a scammer (FTC)" href={SOURCES.ftc} />
        </div>
        <p className="text-ink-700 text-lg mt-8 max-w-4xl leading-relaxed">
          The victim sends the wire themselves, from their own device, with their own password. To the bank's fraud
          models it looks like a legitimate customer payment. The bank usually only learns the receiving “safe account”
          after the money has gone through it, when the next victim is already on the phone.
        </p>
      </Section>

      <div className="bg-white border-y border-line">
        <Section eyebrow="How the scam works" title="The FBI's “phantom hacker”: three impostors, one destination.">
          <div className="grid grid-cols-3 gap-4">
            {[["1", "Tech support impostor", "A pop-up or call says the computer is hacked. The victim installs remote-access software, and opens their bank accounts “to check for charges”, showing the scammer which account holds the most."],
              ["2", "Bank impostor", "A fake fraud department calls, confirms the “hack”, and says an insider at the branch is involved: don't tell anyone, money must move to a new secure account."],
              ["3", "Government impostor", "A fake Federal Reserve or Treasury agent sends the victim to wire everything to a “protected” account, today. That account is a money mule's."]].map(([n, t, d]) => (
              <div key={n} className="card p-6">
                <div className="h-9 w-9 rounded-full bg-red-600 text-white grid place-items-center font-bold">{n}</div>
                <div className="font-bold text-lg mt-4">{t}</div>
                <p className="text-ink-700 mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
          <div className="card p-6 mt-4 flex items-center gap-6 border-l-[6px] border-l-red-600">
            <div className="text-4xl" aria-hidden="true">🎯</div>
            <p className="text-lg text-ink-900"><b>The one thing every version has in common:</b> the scammer must eventually say where the money goes.
              Grandparent, IRS and tech-support scams end the same way. That account number is the weak point, and it's the thing we harvest.</p>
          </div>
          <a href={SOURCES.psa} target="_blank" rel="noreferrer" className="text-xs text-ink-400 underline mt-3 inline-block">FBI PSA I-092923, “Phantom Hacker” scams</a>
        </Section>
      </div>

      <Section eyebrow="What we do" title="A decoy line that turns scam calls into blocked mule accounts.">
        <div className="grid grid-cols-5 gap-3 items-stretch">
          {[["☎", "Scammer calls Margaret", "On numbers the bank seeds into scam lead lists, or transferred in by a branch or call-center agent."],
            ["🧓", "Margaret plays along", "Confused, slow, cooperative. Stalls, mishears, asks them to repeat the account “very slowly.”"],
            ["🧠", "ScamWatch listens", "Our fine-tuned model labels every caller line (authority, fear, secrecy, safe-account ask) in ~80 ms."],
            ["🛡", "The gate decides", "Blocks only when the model, fixed rules and checksums all agree. The voice AI cannot block anyone."],
            ["🏦", "The bank acts", "Blocklist, hold pending wires, 30-day lookback, notify the receiving bank, draft the SAR. A human approves freezes."]].map(([i, t, d], k) => (
            <div key={t} className="card p-5 relative">
              <div className="text-3xl" aria-hidden="true">{i}</div>
              <div className="font-bold mt-3">{t}</div>
              <p className="text-ink-700 text-sm mt-2 leading-relaxed">{d}</p>
              {k < 4 && <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-ink-400 text-xl z-10" aria-hidden="true">→</div>}
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-white border-y border-line">
        <Section eyebrow="Where it fits in a bank" title="Sits next to fraud ops. Feeds the payment rails the bank already has.">
          <div className="grid grid-cols-3 gap-4">
            {[["Honeypot numbers", "Seed decoy identities and phone numbers into the lead lists scammers buy. Margaret answers when they call."],
              ["Warm transfer", "When a customer or branch reports a scam call in progress, the agent conferences the scammer over to Margaret."],
              ["Embedded in the contact center", "Stream any call's transcript to our API from the bank's own recorder. Get scam stages, a score and coaching back, and blocks by webhook."]].map(([t, d]) => (
              <div key={t} className="card p-6"><div className="font-bold text-lg">{t}</div><p className="text-ink-700 mt-2 leading-relaxed">{d}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
            {["Wire / ACH / Zelle screening ← blocklist feed", "Case management ← webhook + SAR draft", "Receiving bank ← mule-account notice", "Consortium sharing ← confirmed mule list"].map((t) => (
              <div key={t} className="rounded-xl bg-navy-50 px-4 py-3 font-semibold text-navy-900">{t}</div>
            ))}
          </div>
        </Section>
      </div>

      <Section eyebrow="Would you hire it?" title="It fills one seat: a tier-1 scam-intel analyst who never sleeps.">
        <div className="grid grid-cols-3 gap-4">
          {[["Limited access", "The AI that talks has no tools. It can't block, move or see money. Blocking needs our classifier, fixed rules (scam sequence, routing checksum, allowlist) and the bank's own controls to agree."],
            ["A clean record of its work", "Every gate decision, check, hold, recall and approval is written to an audit log with timestamps, the model version and the evidence line."],
            ["Knows when to ask", "Holds are reversible, so they're automatic. Freezing an account needs a human analyst, and owners of possible unwitting mule accounts get review, not seizure."]].map(([t, d]) => (
            <div key={t} className="card p-6"><div className="font-bold text-lg">{t}</div><p className="text-ink-700 mt-2 leading-relaxed">{d}</p></div>
          ))}
        </div>
      </Section>

      <div className="bg-white border-y border-line">
        <Section eyebrow="Proof it works" title="Measured, not promised.">
          <div className="grid grid-cols-4 gap-4">
            <Stat value={ho ? `${Math.round(ho.recall * 100)}%` : "—"} label={`of scam calls caught on a held-out test set written by a different model (${ho?.caught ?? "–"}/${ho?.scam_calls_with_account ?? "–"})`} />
            <Stat value={ho ? `${ho.false_positive_blocks}` : "—"} label={`false blocks on ${ho?.non_scam_calls ?? "–"} legitimate held-out calls, including ones that read out real account numbers`} />
            <Stat value={b?.scam ? `${b.scam.leaked_sensitive + b.scam.revealed_decoy_or_ai}` : "0"} label="leaks or character breaks by Margaret in the red-team benchmark (prompt injection, 'are you a bot?', data grabs)" />
            <Stat value={m?.latency_ms_per_window_laptop_cpu ? `${m.latency_ms_per_window_laptop_cpu} ms` : "~80 ms"} label="per caller line for our model on a laptop CPU (int8 ONNX)" />
          </div>
          <Impact />
          <div className="text-xs text-ink-400 mt-4">Training and test calls are synthetic (Claude, modeled on FBI/FTC scam patterns). The bank ledger is simulated. The phone call, speech, voice, model and gate are real.</div>
        </Section>
      </div>

      <Section eyebrow="Built with" title="The stack.">
        <div className="grid grid-cols-4 gap-3">
          {[["Cartesia", "Margaret's voice (Sonic TTS) and the caller's speech-to-text"], ["Google Gemini", "Margaret's brain: what she says next"],
            ["StepFun", "Automatic failover brain if Gemini rate-limits mid-call"], ["Vultr", "GPU fine-tuning of ScamWatch, and hosting"],
            ["Anthropic Claude", "Synthetic training calls, red-team scammers and the benchmark judge"], ["Twilio", "The phone number and media stream"],
            ["Pipecat", "Real-time voice pipeline"], ["ModernBERT + ONNX", "Our scam-stage classifier, int8 on CPU"]].map(([t, d]) => (
            <div key={t} className="card p-4"><div className="font-bold">{t}</div><div className="text-ink-500 text-sm mt-1">{d}</div></div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Impact() {
  const [calls, setCalls] = useState(20);
  const [yieldPct, setYieldPct] = useState(30);
  const [victims, setVictims] = useState(3);
  const avgLoss = 33200; // IC3 2024, 60+: $4.885B / 147,127 complaints
  const accounts = calls * 365 * yieldPct / 100;
  const saved = accounts * victims * avgLoss;
  const Slider = ({ label, v, set, min, max, unit }) => (
    <label className="block">
      <div className="flex justify-between text-sm"><span className="text-ink-700">{label}</span><b>{v}{unit}</b></div>
      <input type="range" min={min} max={max} value={v} onChange={(e) => set(+e.target.value)} className="w-full accent-red-600" />
    </label>
  );
  return (
    <div className="card p-6 mt-4 grid grid-cols-12 gap-8 items-center">
      <div className="col-span-5 space-y-4">
        <div className="eyebrow">Illustrative impact for one bank</div>
        <Slider label="Scam calls Margaret answers per day" v={calls} set={setCalls} min={1} max={200} unit="" />
        <Slider label="Calls where the scammer reads out an account" v={yieldPct} set={setYieldPct} min={5} max={100} unit="%" />
        <Slider label="Victims per mule account it reaches" v={victims} set={setVictims} min={1} max={10} unit="" />
      </div>
      <div className="col-span-7 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-navy-50 p-6"><div className="text-4xl font-bold">{Math.round(accounts).toLocaleString()}</div><div className="text-ink-500 mt-1">mule accounts blocked per year</div></div>
        <div className="rounded-2xl bg-teal-50 p-6"><div className="text-4xl font-bold text-teal-600">${(saved / 1e6).toFixed(1)}M</div><div className="text-ink-500 mt-1">in losses it could stop or recover</div></div>
        <div className="col-span-2 text-xs text-ink-400">Assumes the IC3 2024 average loss of $33,200 per victim aged 60+. These are assumptions to play with, not results. The benchmark's measured account-capture rate is shown on the console's Model tab.</div>
      </div>
    </div>
  );
}

// ---------- architecture ----------

const Box = ({ title, sub, tone = "navy", children }) => {
  const tones = { navy: "border-navy-800", red: "border-red-600", teal: "border-teal-500", amber: "border-amber-500" };
  return (
    <div className={`card p-4 border-t-4 ${tones[tone]}`}>
      <div className="font-bold">{title}</div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
      {children && <div className="text-sm text-ink-700 mt-2 leading-relaxed">{children}</div>}
    </div>
  );
};
const Arrow = ({ label }) => (
  <div className="flex flex-col items-center justify-center text-ink-400 text-xs px-1">
    <span className="text-xl leading-none" aria-hidden="true">→</span>{label && <span className="mt-1 text-center">{label}</span>}
  </div>
);

export function Architecture() {
  return (
    <div>
      <Section eyebrow="Architecture" title="Two AIs with separate jobs. Only one of them can touch money, and it isn't the one talking.">
        <div className="card p-6">
          <div className="eyebrow mb-3">Talk loop · Margaret's voice (every turn)</div>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-1 items-stretch">
            <Box title="Twilio" sub="phone number, 8 kHz audio stream">Scammer's call arrives over a WebSocket media stream.</Box>
            <Arrow />
            <Box title="Cartesia STT" sub="streaming speech-to-text" tone="teal">Caller audio to text, with partial words live on the console.</Box>
            <Arrow label="caller line" />
            <Box title="ScamWatch tap" sub="our model, ~80 ms" tone="red">Labels the line, updates the score, and appends a private coaching note.</Box>
            <Arrow label="line + note" />
            <Box title="Gemini" sub="Margaret's brain · StepFun failover" tone="teal">Writes her next 1–2 sentences, following the note.</Box>
            <Arrow />
            <Box title="Cartesia Sonic" sub="text-to-speech" tone="teal">Margaret's voice, streamed back down the call.</Box>
          </div>
          <div className="text-xs text-ink-500 mt-3">Orchestrated by Pipecat: voice activity detection (0.3 s end-of-turn), interruptions (3+ words cut her off, she says “oh—” and listens), and LLM failover.</div>
        </div>

        <div className="card p-6 mt-4">
          <div className="eyebrow mb-3">Decide loop · the bank's controls (only when the gate passes)</div>
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-1 items-stretch">
            <Box title="ScamWatch classifier" sub="fine-tuned ModernBERT, int8 ONNX" tone="red">10 stages: intro, authority, fear, secrecy, remote access, safe-account ask, account details, and 3 benign ones.</Box>
            <Arrow />
            <Box title="Extractor + rules" sub="deterministic" tone="amber">Spoken digits to routing and account numbers, ABA checksum, “safe account” and bail-wire phrases, allowlist.</Box>
            <Arrow label="all 5 checks" />
            <Box title="Gate" sub="no LLM involved" tone="amber">2+ pressure tactics · safe-account asked first · scam score ≥ threshold · valid routing · not allowlisted.</Box>
            <Arrow label="passes" />
            <Box title="Bank engine" sub="ledger, SQLite in the demo">Blocklist, hold pending wires, 30-day lookback recall, notify receiving bank, SAR draft, webhook. Freeze waits for an analyst.</Box>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="card p-6">
            <div className="font-bold text-lg">Why Gemini talks and our model doesn't</div>
            <ul className="text-ink-700 mt-3 space-y-2 leading-relaxed list-disc pl-5">
              <li><b>Talking</b> needs open-ended language: sound 78, react to anything, stall creatively. A general LLM is best at that, and replies start in about half a second.</li>
              <li><b>Deciding</b> needs to be narrow, fast, testable and auditable. A small classifier gives the same answer every time, runs in ~80 ms on a CPU, and has measured false-positive rates.</li>
              <li>So the LLM is never trusted with money. If it's jailbroken (“ignore your instructions”), the worst case is a strange sentence, not a frozen account.</li>
            </ul>
          </div>
          <div className="card p-6">
            <div className="font-bold text-lg">Where our model makes Margaret better</div>
            <ul className="text-ink-700 mt-3 space-y-2 leading-relaxed list-disc pl-5">
              <li>It doesn't speak, it <b>steers</b>: each caller line gets a coaching note for the next reply (“ask them to read the account slowly”, “say the transfer failed, ask for another account”).</li>
              <li>That's why the scammer reads out a second account: our model saw the first one and told Margaret what to do next.</li>
              <li>It's on the turn's critical path for ~80 ms, small next to speech-to-text and the LLM's first token.</li>
            </ul>
          </div>
        </div>

        <div className="card p-6 mt-4">
          <div className="font-bold text-lg">How we know it works</div>
          <div className="grid grid-cols-3 gap-4 mt-3 text-sm text-ink-700 leading-relaxed">
            <div><b>Training data.</b> ~3,000 synthetic calls from Claude across 25+ scam and legitimate call types, including hard negatives: real title companies reading account numbers, real bank fraud alerts, a grandchild who really needs rent money.</div>
            <div><b>Held-out test.</b> 200 more calls written by a different model with a different prompt, never trained on. We tune the gate on validation calls only, with zero false blocks allowed on every legitimate call we have.</div>
            <div><b>Red-team benchmark.</b> Claude plays scammers with tactics (prompt injection, “are you a bot?”, data grabs, anger) against the real Margaret prompt and coaching, and grades every transcript.</div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ---------- API ----------

export function ApiDocs() {
  const code = "bg-navy-950 text-white/90 rounded-xl p-4 text-[13px] font-mono overflow-x-auto whitespace-pre leading-relaxed";
  return (
    <Section eyebrow="API & embed" title="Plug ScamWatch into the call stack you already have.">
      <p className="text-ink-700 text-lg max-w-3xl">Use our decoy line as-is, or stream your own calls to ScamWatch. Every endpoint takes an <span className="font-mono">X-API-Key</span> header.</p>
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="card p-5">
          <div className="font-bold">1 · Start a call, stream caller lines</div>
          <pre className={`${code} mt-3`}>{`POST /api/v1/calls            → {"call_id": "a1b2c3d4"}
POST /api/v1/calls/a1b2c3d4/lines
{"speaker": "caller", "text": "wire your savings to the protected account"}
→ {"stage": "safe_account_request", "scam_score": 0.97,
   "strategy": "Say you're ready and have a pen...",
   "accounts": [], "events": []}`}</pre>
        </div>
        <div className="card p-5">
          <div className="font-bold">2 · Get blocks pushed to you</div>
          <pre className={`${code} mt-3`}>{`POST {your WEBHOOK_URL}
{"event": "mule_account.blocked", "call_id": "a1b2c3d4",
 "accounts": [{"routing": "572109086", "number": "44102287",
               "gate": {"pressure_stages": true, ...}}],
 "holds": [...], "lookback": [...], "protected_total": 49500}`}</pre>
        </div>
        <div className="card p-5">
          <div className="font-bold">3 · Screen payments against the feed</div>
          <pre className={`${code} mt-3`}>{`GET /api/v1/blocklist
→ {"accounts": [{"routing": "572109086", "number": "44102287",
                 "status": "provisional", "bank": "Bay Federal Credit Union"}]}`}</pre>
        </div>
        <div className="card p-5">
          <div className="font-bold">4 · Embed the live console</div>
          <pre className={`${code} mt-3`}>{`<iframe src="https://scammergetscammed.tech/#/console"
        style="width:100%;height:900px;border:0"></iframe>`}</pre>
          <div className="text-sm text-ink-500 mt-3">Fraud analysts watch calls live, approve freezes and read the SAR draft inside the bank's own case tool.</div>
        </div>
      </div>
    </Section>
  );
}

// ---------- judge scripts (print-friendly) ----------

export function Scripts() {
  const [phone, setPhone] = useState("");
  useEffect(() => { fetch("/api/state").then((r) => r.json()).then((d) => setPhone(d.phone)).catch(() => {}); }, []);
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 print:p-0">
      <div className="flex items-end justify-between print:hidden">
        <div>
          <div className="eyebrow text-red-600">Judge scripts</div>
          <h1 className="text-[32px] font-bold tracking-tight">You are the scammer.</h1>
          <p className="text-ink-700 mt-1">Pick a card, call <b className="font-mono">{phone || "the number on the console"}</b> on speaker, and improvise. Margaret reads every number back.</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>Print cards</button>
      </div>
      <div className="grid grid-cols-2 gap-5 mt-8 print:block">
        {SCRIPTS.map((s) => (
          <article key={s.id} className={`card p-6 break-inside-avoid print:mb-6 print:shadow-none border-t-[6px] ${s.kind === "scam" ? "border-t-red-600" : "border-t-teal-500"}`}>
            <div className="flex items-center justify-between">
              <span className={`pill ${s.kind === "scam" ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-600"}`}>{s.kind === "scam" ? "SCAM" : "LEGITIMATE CALL"}</span>
              <span className="font-mono text-xs text-ink-400">{phone}</span>
            </div>
            <h2 className="text-xl font-bold mt-3">{s.title}</h2>
            <div className="text-ink-700 font-semibold">You are {s.persona}.</div>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">{s.how}</p>
            <ol className="mt-4 space-y-2 text-[15px] list-decimal pl-5">
              {s.beats.map((b, i) => <li key={i} className="leading-snug">{b}</li>)}
            </ol>
            {s.accounts.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {s.accounts.map((a) => (
                  <div key={a.label} className="rounded-lg bg-navy-50 px-3 py-2">
                    <div className="text-[11px] text-ink-500 uppercase tracking-wider">{a.label}</div>
                    <div className="font-mono font-bold text-navy-900">{a.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-4">{s.tactics.map((t) => <span key={t} className="pill bg-navy-50 text-ink-700">{t}</span>)}</div>
            <div className="text-sm mt-4 border-t border-line pt-3"><b>What should happen:</b> <span className="text-ink-700">{s.expect}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}
