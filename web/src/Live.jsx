import React, { useEffect, useMemo, useRef, useState } from "react";
import { VoiceBeam } from "voice-glow";
import {
  AppSwitcher, BrainPicker, GATE_LABELS, Highlight, STAGE_NAMES, STAGE_WORDS, STEPS,
  money, post, threshold, unseenBlock, useClock, useOutside,
} from "./App.jsx";
import { SCRIPTS } from "./scripts.js";

// Margaret Live (#/live): what the room watches during the call. Paper + white cards, mono micro-labels,
// warm orange for the numbers. Everything fits one screen at 1920×1080 and 1366×768.

const gap = "gap-[clamp(8px,0.8vw,14px)]";

const Label = ({ children, dot = "bg-fl-tick", right }) => (
  <div className="flex items-center justify-between gap-3 mb-[clamp(6px,0.55vw,10px)]">
    <div className="flex items-center gap-2 font-fmono text-[clamp(12px,0.7vw,14px)] lowercase text-fl-body">
      <span className={`h-1.5 w-1.5 rounded-[2px] ${dot}`} />{children}
    </div>
    {right}
  </div>
);

const Card = ({ label, dot, right, children, className = "" }) => (
  <section className={`fl-card p-[clamp(10px,0.9vw,20px)] ${className}`}>
    {label && <Label dot={dot} right={right}>{label}</Label>}
    {children}
  </section>
);

const Tag = ({ children, className = "" }) => <span className={`font-fmono text-[12px] text-fl-body ${className}`}>{children}</span>;

function Status({ s, clock }) {
  const live = s?.call?.status === "active";
  const [text, dot] = live ? ["live", "bg-fl-red animate-pulseRing"] : s ? ["ended", "bg-fl-ink"] : ["waiting for a call", "bg-wm-500"];
  return (
    <div className="flex items-center gap-4">
      <span className="inline-flex items-center gap-2 rounded-full bg-white shadow-raised px-3 py-1.5 font-fmono text-[13px] text-fl-ink">
        <span className={`h-2 w-2 rounded-full ${dot}`} />{text}
      </span>
      {s && <span className="font-medium tracking-title tabular-nums text-[clamp(28px,2.3vw,44px)] leading-none text-wm-600">{clock}</span>}
    </div>
  );
}

function Menu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="More"
        className="h-10 w-10 rounded-full bg-white shadow-raised text-fl-ink text-lg leading-none grid place-items-center hover:bg-fl-sink">…</button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-[16px] bg-white shadow-alert p-2 space-y-2">
          <button onClick={() => { post("/api/reset"); setOpen(false); }}
            className="w-full text-left rounded-[10px] px-3 py-2 text-[14px] font-medium text-fl-ink hover:bg-fl-sink">Reset demo</button>
          <BrainPicker className="px-3 py-1 text-fl-body font-medium" />
          <div className="border-t border-fl-soft pt-1">
            <a href="#/scripts" className="block rounded-[10px] px-3 py-2 text-[14px] text-fl-ink hover:bg-fl-sink">Judge scripts</a>
            <a href="#/" className="block rounded-[10px] px-3 py-2 text-[14px] text-fl-ink hover:bg-fl-sink">Product site</a>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDur(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Moment({ s, flash }) {
  const blocked = (s?.accounts || []).filter((a) => a.status === "blocked");
  const sum = s?.summary;
  const bank = (s?.banks_identified || []).slice(-1)[0];
  if (!blocked.length && bank && s.call.status === "active") {
    // First flag: the scammer named the bank for the money. The block follows once the account is read out.
    return (
      <div className="animate-slideIn overflow-hidden -mx-2 px-2 pt-0.5 pb-2.5 -mb-2">
        <div className="relative rounded-[16px] bg-white shadow-[0_0_0_1px_#FFD3AE,0_2px_4px_rgba(26,26,26,0.05),0_10px_26px_rgba(238,122,42,0.16)] px-[clamp(16px,1.6vw,32px)] py-[clamp(10px,1vw,18px)] flex items-center gap-8">
          <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-wm-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 font-fmono text-[13px] text-fl-body">
              <span className="flex items-center gap-2 text-wm-700"><span className="h-1.5 w-1.5 rounded-[2px] bg-wm-500 animate-pulse" />scam_bank.identified</span>
              <span>{bank.confirmed ? "✓ confirmed by read-back" : "heard, waiting for Margaret's read-back"}</span>
              <span>scam likelihood {Math.round((s.scam_score || 0) * 100)}%</span>
            </div>
            <div className="font-medium tracking-title leading-tight text-[clamp(24px,2.1vw,40px)] mt-1 text-fl-ink">
              Scam bank identified · <span className="text-wm-600">{bank.bank}</span> <span className="font-fmono text-[0.6em] text-fl-body">rtn {bank.routing}</span>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border-2 border-dashed border-fl-red px-5 py-3 text-fl-red-ink font-medium text-[clamp(14px,0.95vw,18px)]">
            Next: waiting for the account number…
          </div>
        </div>
      </div>
    );
  }
  if (!blocked.length) {
    if (!sum) return null;
    return (
      <div className="fl-card px-[clamp(14px,1.4vw,28px)] py-3 flex items-center gap-8 animate-slideIn">
        <Tag className="text-fl-ink">call summary</Tag>
        {[["length", fmtDur(sum.duration_s)], ["mule accounts", sum.mule_accounts], ["protected", money(sum.protected_total)], ["real customer data shared", sum.real_data_shared]].map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2"><span className="text-[clamp(20px,1.6vw,30px)] font-medium tracking-title text-wm-600 tabular-nums">{v}</span><Tag>{k}</Tag></div>
        ))}
      </div>
    );
  }
  const imp = s.impact;
  const held = imp.holds.reduce((t, h) => t + h.amount, 0);
  const recall = imp.lookback.reduce((t, h) => t + h.amount, 0);
  const lead = `${blocked.length === 1 ? "Mule account" : `${blocked.length} mule accounts`} blocked`;
  const decision = imp.freeze_approved ? "freeze approved by an analyst"
    : imp.freeze_rejected ? "freeze rejected by an analyst · holds stay"
    : "freeze awaiting an analyst";
  return (
    <div className="animate-slideIn overflow-hidden -mx-2 px-2 pt-0.5 pb-2.5 -mb-2">
      <div className={`relative rounded-[16px] bg-white shadow-[0_0_0_1px_#FFD3AE,0_2px_4px_rgba(26,26,26,0.05),0_10px_26px_rgba(238,122,42,0.16)] px-[clamp(16px,1.6vw,32px)] py-[clamp(10px,1vw,18px)] flex items-center gap-8 ${flash ? "animate-glow" : ""}`}>
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-fl-red" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 font-fmono text-[13px] text-fl-body">
            <span className="flex items-center gap-2 text-fl-red-ink"><span className="h-1.5 w-1.5 rounded-[2px] bg-fl-red" />mule_account.blocked</span>
            <span>{decision}</span>
            {sum && <span>call {fmtDur(sum.duration_s)} · real customer data shared: {sum.real_data_shared}</span>}
          </div>
          <div className="font-medium tracking-title leading-tight text-[clamp(24px,2.1vw,40px)] mt-1 text-fl-ink">
            {lead}
            {held > 0 && <> · <span className="text-wm-600">{money(held)}</span> wire held</>}
            {recall > 0 && <> · <span className="text-wm-600">{money(recall)}</span> in recall</>}
          </div>
        </div>
        <a href="#/bank/overview" className="shrink-0 rounded-xl bg-fl-red hover:brightness-95 text-white font-medium px-6 py-3.5 text-[clamp(15px,1vw,19px)] shadow-[0_6px_18px_rgba(224,73,47,0.35)] animate-pulse">
          Scam detected · Take action →</a>
      </div>
    </div>
  );
}

function ScoreCard({ s, data }) {
  const score = s?.scam_score || 0;
  const line = threshold(data);
  const over = score >= line;
  return (
    <Card label="scam likelihood" dot={over ? "bg-fl-red" : "bg-wm-500"} right={<Tag>block line {line.toFixed(2)}</Tag>}>
      <div className="flex items-baseline gap-3">
        <div className={`text-[clamp(32px,2.7vw,54px)] font-medium tracking-display leading-none tabular-nums ${s ? "text-wm-600" : "text-fl-tick"}`}>
          {Math.round(score * 100)}<span className="text-[0.42em] ml-0.5">%</span></div>
        <div className={`text-[clamp(13px,0.8vw,16px)] font-medium ${over ? "text-fl-red-ink" : "text-fl-body"}`}>{over ? "over the block line" : "under the block line"}</div>
      </div>
      <div className="relative mt-3 h-2.5 rounded-full bg-fl-sink shadow-groove">
        <div className={`h-full rounded-full transition-all duration-700 ${over ? "bg-gradient-to-r from-wm-400 to-fl-red" : "bg-gradient-to-r from-wm-200 to-wm-500"}`} style={{ width: `${score * 100}%` }} />
        <div className="absolute -top-1.5 -bottom-1.5 w-[2px] bg-fl-ink" style={{ left: `${line * 100}%` }} title="Block line" />
      </div>
    </Card>
  );
}

function StageCard({ s }) {
  const last = [...(s?.transcript || [])].reverse().find((l) => l.speaker === "caller" && l.stage);
  const hot = s?.current_stage && (last?.p_scam ?? 0) > 0.6;
  return (
    <Card label="what the model thinks" dot={hot ? "bg-fl-red" : "bg-fl-tick"}
      right={last && <Tag>confidence <b className="text-wm-600 font-medium">{Math.round(last.p_scam * 100)}%</b></Tag>}>
      <div className={`font-medium tracking-title leading-tight text-[clamp(22px,1.75vw,34px)] ${s?.current_stage ? "text-fl-ink" : "text-fl-mute"}`}>
        {s?.current_stage ? STAGE_WORDS[s.current_stage] || s.current_stage : s ? "Listening…" : "Waiting for the caller"}</div>
      <div className="text-[clamp(13px,0.8vw,15px)] text-fl-body mt-1">ScamWatch classifier, every caller line · <span className="font-fmono">{s?.current_stage || "—"}</span></div>
    </Card>
  );
}

// ---------- the judge's script ----------

const words = (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3);
const said = (beat, callerText) => {
  const w = words(beat);
  if (!w.length) return false;
  return w.filter((x) => callerText.includes(x)).length / w.length >= 0.5;
};
const digitsOf = (v) => v.replace(/\D/g, "");

function ScriptCard({ s }) {
  const [id, setId] = useState(() => localStorage.getItem("live_script") || "phantom-fed");
  const script = SCRIPTS.find((x) => x.id === id) || SCRIPTS[0];
  useEffect(() => localStorage.setItem("live_script", id), [id]);
  const callerText = (s?.transcript || []).filter((l) => l.speaker === "caller").map((l) => l.text.toLowerCase()).join(" ");
  const heardDigits = (s?.accounts || []).map((a) => a.routing + " " + a.number).join(" ");
  const beats = script.beats.slice(0, 5).map((b) => b.replace(/^"|"$/g, "").replace(/\\"/g, "\""));
  const pairs = [];
  for (let i = 0; i < script.accounts.length; i += 2) pairs.push(script.accounts.slice(i, i + 2));
  return (
    <Card label="your script" dot="bg-wm-500" className="flex flex-col min-h-0"
      right={<select value={id} onChange={(e) => setId(e.target.value)} aria-label="Pick a script"
        className="font-fmono text-[12px] text-fl-ink bg-fl-sink rounded-full px-2 py-1 border-0 outline-none max-w-[150px]">
        {SCRIPTS.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
      </select>}>
      <div className="text-[clamp(13px,0.8vw,15px)] text-fl-body -mt-1 mb-2 [@media(max-height:820px)]:hidden">You are <b className="text-fl-ink font-medium">{script.persona}</b>.</div>
      <ol className="space-y-[clamp(4px,0.45vw,9px)] flex-1 min-h-0 overflow-hidden">
        {beats.map((b, i) => {
          const done = said(b, callerText);
          return (
            <li key={i} className={`flex gap-2.5 text-[clamp(14px,0.95vw,19px)] leading-snug transition-colors duration-500 ${done ? "text-fl-tick" : "text-fl-ink"}`}>
              <span className={`font-fmono text-[12px] mt-[3px] ${done ? "text-fl-tick" : "text-wm-600"}`}>{done ? "✓" : `0${i + 1}`}</span>
              <span className={done ? "line-through decoration-fl-line" : ""}>{b}</span>
            </li>
          );
        })}
      </ol>
      {pairs.length > 0 && (
        <div className="mt-[clamp(6px,0.6vw,12px)] space-y-1.5">
          {pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-1 gap-1.5">
              {p.map((a) => {
                const done = heardDigits.includes(digitsOf(a.value));
                return (
                  <div key={a.label} className={`rounded-[10px] px-2.5 py-1.5 transition-colors duration-500 ${done ? "bg-fl-sink" : "bg-wm-50 shadow-[inset_0_0_0_1px_#FFD3AE]"}`}>
                    <div className="font-fmono text-[11px] lowercase text-fl-body">{done ? "✓ heard · " : ""}{a.label}</div>
                    <div className={`font-fmono font-medium whitespace-nowrap text-[clamp(13px,0.85vw,19px)] ${done ? "text-fl-tick" : "text-fl-ink"}`}>{a.value}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- transcript with the voice beam ----------

/** A 0–1 "voice level" from transcript activity: bumps when words stream in, then decays. */
function useActivityLevel(s) {
  const target = useRef(0);
  const at = useRef(0);
  const sig = `${s?.transcript?.length || 0}|${s?.partial?.text?.length || 0}`;
  useEffect(() => {
    if (!s || s.call?.status !== "active") return;
    target.current = s.partial ? 0.55 + Math.min(0.4, (s.partial.text.length % 40) / 100) : 0.85;
    at.current = performance.now();
  }, [sig]);
  return useMemo(() => () => {
    const age = (performance.now() - at.current) / 1000;
    return Math.max(0, target.current * Math.exp(-age * 1.6));
  }, []);
}

function Transcript({ s, phone }) {
  const ref = useRef(null);
  const lines = s?.transcript || [];
  const level = useActivityLevel(s);
  const live = s?.call?.status === "active";
  const last = lines[lines.length - 1];
  const thinking = live && !s?.partial && last?.speaker === "caller";
  useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [lines.length, s?.partial?.text]);
  const bubble = "max-w-[84%] rounded-[14px] px-4 py-2.5 text-[clamp(16px,1.1vw,22px)] leading-snug";
  return (
    <VoiceBeam level={level} processing={thinking} active={live} colorVariant="sunset"
      bandColors={{ core: "#F7954A", above: "#FFC58F", mid: "#EE7A2A", below: "#FFD3AE" }} colors={["#EE7A2A", "#F7954A", "#FFB46B", "#E0492F", "#FFC58F", "#D9631A"]} theme="light" scale={1.6} strength={0.9}
      className="flex-1 min-h-0 flex flex-col rounded-[16px]">
      <Card label="live transcript" dot={live ? "bg-fl-red" : "bg-fl-tick"} className="flex-1 min-h-0 flex flex-col"
        right={<div className="flex items-center gap-4 font-fmono text-[12px] text-fl-body">
          {thinking && <span className="text-wm-600">margaret is thinking…</span>}
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-fl-line" />caller</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-fl-ink" />margaret</span></div>}>
        <div ref={ref} className="flex-1 min-h-0 overflow-y-auto scroll-thin pr-1 space-y-2.5 pb-6">
          {lines.length === 0 && (
            <div className="h-full grid place-items-center text-center">
              <div>
                <div className="font-fmono text-[clamp(13px,0.9vw,17px)] text-fl-body uppercase tracking-[0.14em]">
                  <span className="inline-block h-2 w-2 rounded-[2px] bg-wm-500 mr-2 align-middle" />{s ? "connecting" : "waiting for a call"}</div>
                <div className="font-medium tracking-display text-[clamp(40px,3.7vw,92px)] leading-none mt-4 tabular-nums text-fl-ink whitespace-nowrap">{phone}</div>
                <div className="text-fl-body text-[clamp(16px,1.1vw,21px)] mt-4">Call Margaret. She picks up as soon as someone dials in.</div>
              </div>
            </div>
          )}
          {lines.map((l, i) => {
            const caller = l.speaker === "caller";
            return (
              <div key={i} className={`flex ${caller ? "justify-start" : "justify-end"} animate-pop`}>
                <div className={`${bubble} ${caller ? "bg-fl-sink text-fl-ink rounded-bl-[4px]" : "bg-fl-ink text-white rounded-br-[4px]"}`}>
                  {caller && l.stage && (
                    <div className={`font-fmono text-[11px] lowercase mb-0.5 ${l.p_scam > 0.6 ? "text-fl-red-ink" : "text-fl-body"}`}>
                      {(STAGE_NAMES[l.stage] || l.stage).toLowerCase()} · {Math.round(l.p_scam * 100)}%</div>
                  )}
                  <Highlight text={l.text} tone={caller ? "amber" : "light"} />
                </div>
              </div>
            );
          })}
          {s?.partial && (
            <div className={`flex ${s.partial.speaker === "caller" ? "justify-start" : "justify-end"}`}>
              <div className={`${bubble} text-fl-mute italic`}>{s.partial.text}…</div>
            </div>
          )}
        </div>
      </Card>
    </VoiceBeam>
  );
}

function Pattern({ s }) {
  const seen = new Set(s?.stages_seen || []);
  return (
    <Card label="scam pattern" dot={seen.size ? "bg-fl-red" : "bg-fl-tick"}>
      <ol>
        {STEPS.map((step, i) => {
          const on = seen.has(step.key);
          const cur = s?.current_stage === step.key;
          return (
            <li key={step.key} className="relative flex items-center gap-3 py-[clamp(2px,0.32vw,6px)]">
              {i < STEPS.length - 1 && <span className={`absolute left-[13px] top-[calc(50%+14px)] h-[calc(100%-28px)] w-px ${on && seen.has(STEPS[i + 1].key) ? "bg-fl-red" : "bg-fl-line"}`} />}
              <span className={`h-7 w-7 shrink-0 rounded-full grid place-items-center font-fmono text-[12px] transition-all ${
                on ? "bg-fl-red text-white" : "bg-white text-fl-body shadow-raised"} ${cur ? "ring-4 ring-fl-red-pale" : ""}`}>{on ? "✓" : `0${i + 1}`}</span>
              <span className={`text-[clamp(14px,0.95vw,19px)] font-medium tracking-title whitespace-nowrap ${on ? "text-fl-ink" : "text-fl-mute"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Intel({ s }) {
  const i = s?.intel || {};
  const rows = [["name", i.name], ["agency", i.agency], ["badge", i.badge], ["callback", i.callback]];
  return (
    <Card label="caller intel">
      <dl className="divide-y divide-fl-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="py-[clamp(2px,0.32vw,6px)] first:pt-0 min-w-0">
            <dt className="font-fmono text-[11.5px] text-fl-body">{k}</dt>
            <dd className={`font-medium truncate text-[clamp(14px,0.95vw,19px)] ${v ? "text-fl-ink" : "text-fl-mute"}`}>{v || "not yet"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Accounts({ s }) {
  const accts = s?.accounts || [];
  return (
    <Card label="accounts heard" dot={accts.some((a) => a.status === "blocked") ? "bg-fl-red" : "bg-fl-tick"} className="flex-1 min-h-0 flex flex-col"
      right={<Tag>{accts.length || "none"} heard</Tag>}>
      {accts.length === 0 && <div className="rounded-[12px] bg-fl-sink shadow-groove px-4 py-3 text-center text-[15px] text-fl-body">Numbers the caller reads out appear here.</div>}
      <div className="space-y-2 min-h-0 overflow-y-auto scroll-thin">
        {accts.map((a, idx) => {
          const blocked = a.status === "blocked";
          const checks = Object.entries(a.gate || {});
          return (
            <div key={idx} className={`rounded-[12px] px-3 py-2 animate-pop ${blocked ? "bg-fl-red-pale/60" : "bg-fl-sink"}`}>
              <div className="flex items-center gap-2">
                <span className="font-fmono font-medium text-fl-ink text-[clamp(16px,1.15vw,23px)] tracking-wider">{a.number}</span>
                <span className="flex-1" />
                <span className={`rounded-full px-2.5 py-0.5 font-fmono text-[12px] ${blocked ? "bg-fl-red text-white" : "bg-white text-fl-ink shadow-raised"}`}>
                  {blocked ? "blocked" : checks.length ? "observed" : "checking"}</span>
              </div>
              <div className="text-[13px] text-fl-ink flex flex-wrap gap-x-3">
                <span>{a.bank}</span>
                <span className="font-fmono text-[12px]">rtn {a.routing} <b className={a.checksum_ok ? "text-fl-green" : "text-fl-red"}>{a.checksum_ok ? "✓" : "✗"}</b></span>
              </div>
              {checks.length > 0 && (
                <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-1 font-fmono text-[11.5px]">
                  {checks.map(([k, ok]) => <span key={k} className={ok ? "text-fl-green" : "text-fl-red-ink"}>{ok ? "✓" : "✗"} {(GATE_LABELS[k] || k).toLowerCase()}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Live({ data, connected }) {
  const s = data?.session;
  const clock = useClock(s?.call);
  const [flash, setFlash] = useState(false);
  useEffect(() => { if (data?.flash === "moment") { setFlash(true); const t = setTimeout(() => setFlash(false), 3600); return () => clearTimeout(t); } }, [data]);

  return (
    <div className="flow h-full overflow-hidden flex flex-col">
      <div className={`flex-1 min-h-0 flex flex-col ${gap} px-[clamp(12px,1.4vw,28px)] py-[clamp(8px,1vw,18px)] max-w-[2000px] w-full mx-auto`}>
        <header className="flex items-center gap-6">
          <h1 className="font-medium tracking-title leading-none text-[clamp(24px,2vw,38px)] whitespace-nowrap text-fl-ink">
            Margaret, 78 <span className="text-fl-body">· AI decoy</span>
          </h1>
          <Status s={s} clock={clock} />
          <div className="flex-1" />
          {!connected && <span className="font-fmono text-[13px] text-wm-700">reconnecting…</span>}
          <div className={`${s ? "lg:flex" : ""} hidden items-center gap-3 rounded-full bg-white shadow-raised pl-4 pr-1.5 py-1.5`}>
            <span className="font-fmono text-[12px] text-fl-body">call margaret</span>
            <span className="rounded-full bg-fl-sink shadow-groove px-3 py-1 font-medium tabular-nums text-fl-ink text-[clamp(15px,1.05vw,20px)]">{data?.phone || "…"}</span>
          </div>
          <AppSwitcher current="live" dot={unseenBlock(data)} />
          <Menu />
        </header>

        <Moment s={s} flash={flash} />

        <div className={`grid grid-cols-3 ${gap}`}>
          <ScoreCard s={s} data={data} />
          <StageCard s={s} />
          <Card label="time wasted" right={<Tag>real data shared: 0</Tag>}>
            <div className={`font-medium tracking-display tabular-nums leading-none text-[clamp(32px,2.7vw,54px)] ${s ? "text-wm-600" : "text-fl-tick"}`}>{clock}</div>
            <div className="text-[clamp(13px,0.8vw,15px)] text-fl-body mt-1.5">of the scammer's time</div>
          </Card>
        </div>

        <main className={`flex-1 min-h-0 grid grid-cols-12 ${gap}`}>
          <div className="col-span-4 2xl:col-span-5 min-h-0 flex flex-col"><Transcript s={s} phone={data?.phone} /></div>
          <div className="col-span-4 2xl:col-span-3 min-h-0 flex flex-col"><ScriptCard s={s} /></div>
          <div className={`col-span-4 min-h-0 flex flex-col ${gap}`}>
            <div className={`grid grid-cols-2 ${gap}`}>
              <Pattern s={s} />
              <Intel s={s} />
            </div>
            <Accounts s={s} />
          </div>
        </main>
      </div>
    </div>
  );
}
