import React, { useEffect, useRef, useState } from "react";

const STEPS = [
  { key: "authority", label: "Claims authority" },
  { key: "fear_urgency", label: "Fear & urgency" },
  { key: "secrecy", label: "Demands secrecy" },
  { key: "safe_account_request", label: "Asks for “safe account”" },
  { key: "account_details", label: "Gives account" },
];
const STAGE_NAMES = {
  intro: "Intro", authority: "Authority", fear_urgency: "Fear", secrecy: "Secrecy",
  remote_access: "Remote access", safe_account_request: "Safe-account ask", account_details: "Account details",
  benign_chat: "Benign", legit_business: "Legit business", spam_sales: "Sales",
};
const GATE_LABELS = {
  pressure_stages: "2+ pressure tactics",
  asked_for_safe_account_first: "“Safe account” asked first",
  scam_score: "Scam score ≥ 0.95",
  routing_checksum: "Routing checksum valid",
  not_allowlisted: "Not on allowlist",
};
const money = (n) => "$" + Math.round(n || 0).toLocaleString();
const initials = (name = "") => name.replace(/\(.*\)/, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");

// ---------- data ----------

function useLiveState() {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    let ws, timer;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/dashboard`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => setData(JSON.parse(e.data));
      ws.onclose = () => { setConnected(false); timer = setTimeout(connect, 1000); };
    };
    connect();
    return () => { clearTimeout(timer); ws && ws.close(); };
  }, []);
  return { data, connected };
}

function useClock(call) {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 250); return () => clearInterval(t); }, []);
  if (!call) return "0:00";
  const s = Math.max(0, Math.floor((call.ended_at || now) - call.started_at));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- small pieces ----------

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="9" fill="#14A39C" />
        <path d="M6 22c3-6 6-9 11-9s8 3 11 9" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M10 22v-4M17 22v-7M24 22v-4" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M5 25h24" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <div className="leading-tight">
        <div className="text-white font-bold text-[17px] tracking-tight">Bay Federal</div>
        <div className="text-white/60 text-[11px] font-medium tracking-wide">CREDIT UNION</div>
      </div>
    </div>
  );
}

function Highlight({ text }) {
  const parts = text.split(/(\b(?:\d[\d ]{2,}\d|\d|zero|one|two|three|four|five|six|seven|eight|nine)\b)/gi);
  return parts.map((p, i) =>
    i % 2 ? <mark key={i} className="bg-amber-100 text-amber-900 font-mono font-semibold rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>
  );
}

function StatusPill({ session, clock }) {
  const live = session?.call?.status === "active";
  if (live) return <span className="pill bg-red-50 text-red-700 ring-1 ring-red-200"><span className="h-2 w-2 rounded-full bg-red-600 animate-pulseRing" />Live call · {clock}</span>;
  if (session) return <span className="pill bg-navy-50 text-navy-800 ring-1 ring-navy-100">Call ended · {clock}</span>;
  return <span className="pill bg-white text-ink-500 ring-1 ring-line">Waiting for a call</span>;
}

function Kpi({ label, value, sub, tone = "ink", children }) {
  const tones = { ink: "text-ink-900", green: "text-teal-600", red: "text-red-600", muted: "text-ink-400" };
  return (
    <div className="card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 text-[34px] leading-none font-bold tracking-tight ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1.5 text-sm text-ink-500">{sub}</div>}
      {children}
    </div>
  );
}

// ---------- sections ----------

function KpiRow({ s, clock }) {
  const score = s?.scam_score || 0;
  const blocked = (s?.accounts || []).filter((a) => a.status === "blocked").length;
  const imp = s?.impact;
  return (
    <div className="grid grid-cols-4 gap-4">
      <Kpi label="Scam likelihood" value={score.toFixed(2)} tone={score >= 0.95 ? "red" : score > 0 ? "ink" : "muted"}
        sub={score >= 0.95 ? "Above block threshold (0.95)" : "Block threshold 0.95"}>
        <div className="relative mt-3 h-2 rounded-full bg-navy-50 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${score >= 0.95 ? "bg-red-600" : "bg-amber-400"}`} style={{ width: `${score * 100}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-ink-900/40" style={{ left: "95%" }} />
        </div>
      </Kpi>
      <Kpi label="Mule accounts blocked" value={blocked} tone={blocked ? "red" : "muted"}
        sub={imp?.notified?.length ? `${imp.notified.length} other bank notified` : "Harvested from this call"} />
      <Kpi label="Protected or in recovery" value={money(imp?.protected_total)} tone={imp?.protected_total ? "green" : "muted"}
        sub={imp ? `${imp.holds.length} wire held · ${imp.lookback.length} recalls` : "Across all Bay Federal customers"} />
      <Kpi label="Scammer's time wasted" value={clock} tone={s ? "ink" : "muted"} sub="Real customer data shared: 0" />
    </div>
  );
}

function Stepper({ s }) {
  const seen = new Set(s?.stages_seen || []);
  const done = STEPS.filter((x) => seen.has(x.key)).length;
  return (
    <div className="card px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="card-title">Scam pattern detected</div>
        <div className="text-xs text-ink-500">Trained classifier · <span className="font-mono">{s?.model || "—"}</span></div>
      </div>
      <div className="relative flex justify-between">
        <div className="absolute left-[10%] right-[10%] top-[15px] h-1 bg-navy-50 rounded" />
        <div className="absolute left-[10%] top-[15px] h-1 bg-red-500 rounded transition-all duration-700"
          style={{ width: `${Math.max(0, done - 1) * 20}%` }} />
        {STEPS.map((step, i) => {
          const on = seen.has(step.key);
          const cur = s?.current_stage === step.key;
          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center w-1/5">
              <div className={`h-8 w-8 rounded-full grid place-items-center text-sm font-bold transition-all ${
                on ? "bg-red-600 text-white" : "bg-white text-ink-400 ring-2 ring-line"} ${cur ? "ring-4 ring-red-200" : ""}`}>
                {on ? "✓" : i + 1}
              </div>
              <div className={`mt-2 text-sm font-semibold text-center ${on ? "text-ink-900" : "text-ink-400"}`}>{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Transcript({ s }) {
  const ref = useRef(null);
  const lines = s?.transcript || [];
  useEffect(() => { ref.current && (ref.current.scrollTop = ref.current.scrollHeight); }, [lines.length, s?.partial]);
  return (
    <div className="card flex-1 flex flex-col min-h-0">
      <div className="card-head border-b border-line">
        <div className="card-title">Live transcript</div>
        <div className="flex items-center gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-400" />Caller</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" />Margaret (AI decoy)</span>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto scroll-thin px-5 py-4 space-y-3">
        {lines.length === 0 && (
          <div className="h-full grid place-items-center text-center">
            <div>
              <div className="text-ink-400 text-lg">No active call</div>
              <div className="text-ink-400 text-sm mt-1">Margaret picks up as soon as someone dials in.</div>
            </div>
          </div>
        )}
        {lines.map((l, i) => {
          const caller = l.speaker === "caller";
          return (
            <div key={i} className={`flex ${caller ? "justify-start" : "justify-end"} animate-pop`}>
              <div className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-[19px] leading-snug ${
                caller ? "bg-navy-50 text-ink-900 rounded-bl-md" : "bg-teal-50 text-ink-900 ring-1 ring-teal-100 rounded-br-md"}`}>
                <div className={`text-[11px] font-semibold uppercase tracking-wider mb-0.5 ${caller ? "text-ink-500" : "text-teal-600"}`}>
                  {caller ? "Caller" : "Margaret"}
                  {caller && l.stage && <span className={`ml-2 normal-case tracking-normal ${l.p_scam > 0.6 ? "text-red-600" : "text-ink-400"}`}>
                    · {STAGE_NAMES[l.stage] || l.stage} {Math.round(l.p_scam * 100)}%</span>}
                </div>
                <Highlight text={l.text} />
              </div>
            </div>
          );
        })}
        {s?.partial && (
          <div className={`flex ${s.partial.speaker === "caller" ? "justify-start" : "justify-end"}`}>
            <div className="rounded-2xl px-4 py-2.5 text-[19px] text-ink-400 italic">{s.partial.text}…</div>
          </div>
        )}
      </div>
      {s?.strategy && s.call.status === "active" && (
        <div className="mx-4 mb-4 rounded-xl bg-navy-50 border border-navy-100 px-4 py-2.5 text-sm text-navy-800">
          <span className="font-semibold">Margaret's next move:</span> {s.strategy}
        </div>
      )}
    </div>
  );
}

function TxRow({ t }) {
  const st = {
    pending: ["Pending wire", "bg-amber-50 text-amber-800 ring-amber-200"],
    held: ["Held", "bg-red-50 text-red-700 ring-red-200"],
    recall_requested: ["Recall requested", "bg-navy-50 text-navy-800 ring-navy-100"],
  }[t.status] || [t.status, "bg-navy-50 text-ink-700 ring-line"];
  return (
    <div className={`flex items-center gap-3 px-5 py-3 transition-colors duration-700 ${t.status === "held" ? "bg-red-50/60" : ""}`}>
      <div className="h-10 w-10 shrink-0 rounded-full bg-navy-100 text-navy-800 grid place-items-center text-sm font-bold">{initials(t.customer)}</div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink-900 truncate">{t.customer} <span className="text-ink-500 font-normal">· {t.age}</span></div>
        <div className="text-sm text-ink-500 truncate">Wire to {t.to} · “{t.memo}”</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-lg font-bold ${t.status === "held" ? "text-red-700 line-through decoration-2" : "text-ink-900"}`}>−{money(t.amount)}</div>
        <span className={`pill ring-1 ${st[1]}`}>{st[0]}</span>
      </div>
    </div>
  );
}

function Controls({ data, onApprove, onSar }) {
  const s = data?.session;
  const imp = s?.impact;
  const watch = data?.ledger?.watch || [];
  return (
    <div className="card flex-1 flex flex-col min-h-0">
      <div className="card-head border-b border-line">
        <div className="card-title">Payment activity under watch</div>
        <span className="text-xs text-ink-500">{data?.ledger?.customers || 0} members monitored</span>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin divide-y divide-line">
        {watch.map((t) => <TxRow key={t.transfer_id} t={t} />)}
        {imp?.notified?.map((b) => (
          <div key={b} className="flex items-center gap-3 px-5 py-3 text-sm text-ink-700">
            <div className="h-10 w-10 shrink-0 rounded-full bg-teal-50 text-teal-600 grid place-items-center">✉</div>
            <div><span className="font-semibold">{b}</span> notified of mule account <span className="text-ink-400">(simulated)</span></div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-3 flex items-center gap-2">
        <button className="btn-ghost" disabled={s?.sar?.status !== "ready"} onClick={onSar}>
          {s?.sar?.status === "drafting" ? "Drafting SAR…" : "View SAR draft"}
        </button>
        <div className="flex-1" />
        {imp?.freeze_approved ? (
          <span className="pill bg-teal-50 text-teal-600 ring-1 ring-teal-100 py-2 px-3 text-sm">✓ Freeze approved by analyst</span>
        ) : (
          <button className="btn-danger" disabled={!imp?.freeze_pending} onClick={onApprove}>Approve freeze</button>
        )}
      </div>
    </div>
  );
}

function Intel({ s }) {
  const i = s?.intel || {};
  const rows = [["Claimed name", i.name], ["Claimed agency", i.agency], ["Badge", i.badge], ["Callback number", i.callback]];
  return (
    <div className="card">
      <div className="card-head"><div className="card-title">Caller intel</div></div>
      <dl className="px-5 pb-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-ink-500">{k}</dt>
            <dd className={`font-semibold ${v ? "text-ink-900" : "text-ink-400"}`}>{v || "Not yet"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Accounts({ s }) {
  const accts = s?.accounts || [];
  return (
    <div className="card flex-1 flex flex-col min-h-0">
      <div className="card-head"><div className="card-title">Harvested accounts</div>
        <span className="text-xs text-ink-500">{accts.length} found</span></div>
      <div className="flex-1 overflow-y-auto scroll-thin px-4 pb-4 space-y-3">
        {accts.length === 0 && <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-400">
          Accounts the caller reads out appear here.</div>}
        {accts.map((a, idx) => {
          const blocked = a.status === "blocked";
          return (
            <div key={idx} className={`rounded-xl border p-4 animate-pop ${blocked ? "border-red-200 bg-red-50/50" : "border-line"}`}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-navy-900 text-white grid place-items-center text-xs font-bold">{initials(a.bank)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{a.bank}</div>
                  <div className="text-xs text-ink-500 font-mono">RTN {a.routing}</div>
                </div>
                <span className={`pill ring-1 ${blocked ? "bg-red-600 text-white ring-red-600" : "bg-white text-ink-500 ring-line"}`}>
                  {blocked ? "Blocked" : "Observed"}</span>
              </div>
              <div className="mt-2 font-mono text-[22px] font-bold tracking-wider text-ink-900">{a.number}</div>
              <div className="mt-2 grid grid-cols-1 gap-0.5">
                {Object.entries(a.gate || {}).map(([k, ok]) => (
                  <div key={k} className={`text-xs ${ok ? "text-teal-600" : "text-ink-400"}`}>{ok ? "✓" : "○"} {GATE_LABELS[k] || k}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ children, onClose, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center z-40" onMouseDown={onClose}>
      <div className={`relative bg-white rounded-2xl shadow-2xl p-8 w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[85vh] overflow-y-auto scroll-thin`}
        onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-5 text-ink-500 hover:text-ink-900 text-sm font-semibold">Close ✕</button>
        {children}
      </div>
    </div>
  );
}

// ---------- tabs ----------

function LossCurve({ log }) {
  // Replays the training loss over ~5 s, for the demo video.
  const pts = (log || []).filter((r) => r.loss != null).map((r) => [r.step, r.loss]);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!pts.length) return;
    const t = setInterval(() => setN((k) => (k >= pts.length ? (clearInterval(t), k) : k + 1)), Math.max(16, 5000 / pts.length));
    return () => clearInterval(t);
  }, [log]);
  if (!pts.length) return null;
  const W = 640, H = 220, P = 32;
  const maxX = pts[pts.length - 1][0], maxY = Math.max(...pts.map((p) => p[1]));
  const xy = (p) => [P + (p[0] / maxX) * (W - 2 * P), H - P - (p[1] / maxY) * (H - 2 * P)];
  const d = pts.slice(0, n).map((p, i) => `${i ? "L" : "M"}${xy(p).join(",")}`).join(" ");
  const last = pts[Math.max(0, n - 1)];
  return (
    <div className="col-span-12 card p-5">
      <div className="flex justify-between mb-2">
        <div className="card-title">Training loss (fine-tune on Vultr GPU)</div>
        <div className="font-mono text-sm text-ink-500">step {last[0]} · loss {last[1].toFixed(3)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#E3E8EF" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#E3E8EF" />
        <path d={d} fill="none" stroke="#0E8C86" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <text x={P} y={H - 8} fontSize="11" fill="#8A96A8">0</text>
        <text x={W - P} y={H - 8} fontSize="11" fill="#8A96A8" textAnchor="end">{maxX} steps</text>
      </svg>
    </div>
  );
}

function ModelTab() {
  const [m, setM] = useState(null);
  useEffect(() => { fetch("/api/model").then((r) => r.json()).then(setM).catch(() => setM({})); }, []);
  if (!m) return null;
  if (!m.model) return (
    <div className="card p-10 text-center text-ink-500">No trained model yet. The live call is using the keyword fallback.
      <div className="text-sm mt-2">Run <span className="font-mono">training/train_baseline.py</span> after generating data.</div></div>
  );
  const cl = m.call_level || {};
  const f1 = Object.entries(m.per_stage_f1 || {});
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 grid grid-cols-4 gap-4">
        <Kpi label="False-positive blocks" value={`${cl.false_positive_blocks ?? "—"}`} tone={cl.false_positive_blocks === 0 ? "green" : "red"}
          sub={`on ${cl.non_scam_calls ?? "—"} held-out non-scam calls`} />
        <Kpi label="Scam calls caught" value={cl.recall != null ? `${Math.round(cl.recall * 100)}%` : "—"} sub={`${cl.caught ?? 0} of ${cl.scam_calls_with_account ?? 0} with an account given`} />
        <Kpi label="Stage accuracy" value={`${Math.round((m.accuracy || 0) * 100)}%`} sub={`macro F1 ${m.macro_f1}`} />
        <Kpi label="Inference time" value={`${m.latency_ms_per_window} ms`} sub={`${m.model} · ${m.n_calls} synthetic calls`} />
      </div>
      <LossCurve log={m.train_log} />
      <div className="col-span-5 card p-5">
        <div className="card-title mb-4">F1 score by scam stage</div>
        <div className="space-y-2.5">
          {f1.map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <div className="w-36 text-sm text-ink-700">{STAGE_NAMES[k] || k}</div>
              <div className="flex-1 h-2.5 bg-navy-50 rounded-full overflow-hidden"><div className="h-full bg-navy-800 rounded-full" style={{ width: `${v * 100}%` }} /></div>
              <div className="w-12 text-right font-mono text-sm">{v.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-7 card p-5 overflow-x-auto">
        <div className="card-title mb-4">Confusion matrix (test set)</div>
        <table className="text-xs font-mono">
          <thead><tr><th />{m.confusion.labels.map((l) => <th key={l} className="px-1.5 pb-2 text-ink-500 font-medium rotate-0">{(STAGE_NAMES[l] || l).slice(0, 8)}</th>)}</tr></thead>
          <tbody>
            {m.confusion.matrix.map((row, i) => {
              const max = Math.max(...row, 1);
              return (
                <tr key={i}>
                  <td className="pr-2 text-ink-500 font-sans text-right">{STAGE_NAMES[m.confusion.labels[i]] || m.confusion.labels[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className="text-center w-12 h-8 rounded" style={{
                      background: v ? (i === j ? `rgba(14,140,134,${0.15 + 0.7 * v / max})` : `rgba(220,38,38,${0.15 + 0.6 * v / max})`) : "#F8FAFC",
                      color: v && v / max > 0.5 ? "white" : "#33415C" }}>{v || ""}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab({ s }) {
  const rows = [...(s?.audit || [])].reverse();
  const actorTone = { scamwatch: "bg-navy-50 text-navy-800", rules: "bg-amber-50 text-amber-800", analyst: "bg-teal-50 text-teal-600" };
  return (
    <div className="card overflow-hidden">
      <div className="card-head border-b border-line"><div className="card-title">Audit log · every automated and human decision</div></div>
      <table className="w-full text-sm">
        <thead className="bg-navy-50 text-ink-500 text-xs uppercase tracking-wider">
          <tr><th className="text-left px-5 py-2">Time</th><th className="text-left px-3">Actor</th><th className="text-left px-3">Action</th><th className="text-left px-3">Details</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-400">No decisions yet.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-5 py-2.5 font-mono text-xs text-ink-500 whitespace-nowrap">{String(r.ts).slice(11, 19)}</td>
              <td className="px-3"><span className={`pill ${actorTone[r.actor] || "bg-navy-50 text-ink-700"}`}>{r.actor}</span></td>
              <td className="px-3 font-semibold text-ink-900 whitespace-nowrap">{r.action.replaceAll("_", " ")}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-ink-500 break-all">{JSON.stringify(r.details).slice(0, 220)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrainPicker() {
  const [s, setS] = useState(null);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s?.available) return null;
  const pick = (brain) => fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brain }) })
    .then((r) => r.json()).then((n) => setS({ ...s, ...n }));
  return (
    <label className="flex items-center gap-2 text-white/60 text-xs font-semibold" title="Used from the next call; the others take over if it fails">
      Margaret's brain
      <select value={s.brain} onChange={(e) => pick(e.target.value)}
        className="bg-navy-800 text-white text-sm rounded-lg px-2 py-1 border border-white/10">
        {Object.entries(s.available).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

// ---------- app ----------

export default function App() {
  const { data, connected } = useLiveState();
  const [tab, setTab] = useState("live");
  const [flash, setFlash] = useState(false);
  const [showSar, setShowSar] = useState(false);
  const [hideSummary, setHideSummary] = useState(false);
  const s = data?.session;
  const clock = useClock(s?.call);

  useEffect(() => { if (data?.flash === "moment") { setFlash(true); setTimeout(() => setFlash(false), 3400); } }, [data]);
  useEffect(() => { setHideSummary(false); }, [s?.call?.id]);
  const post = (p) => fetch(p, { method: "POST" });
  const sModel = s ? { ...s, model: data?.model } : { model: data?.model };

  return (
    <div className="h-full flex flex-col">
      <nav className="bg-navy-900 h-16 shrink-0 flex items-center px-6 gap-10">
        <Logo />
        <div className="flex h-full">
          {[["live", "Decoy line"], ["model", "Model"], ["audit", "Audit log"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 h-full text-[15px] font-semibold border-b-[3px] transition ${tab === k ? "text-white border-teal-500" : "text-white/60 border-transparent hover:text-white"}`}>
              {label}</button>
          ))}
        </div>
        <div className="flex-1" />
        {!connected && <span className="text-amber-300 text-xs">Reconnecting…</span>}
        <BrainPicker />
        <a href="#/" className="text-white/60 hover:text-white text-sm font-semibold">Product site</a>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-white text-sm font-semibold">J. Rivera</div>
            <div className="text-white/60 text-xs">Fraud Operations</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-teal-500 text-white grid place-items-center text-sm font-bold">JR</div>
        </div>
      </nav>

      <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-5 max-w-[1800px] w-full mx-auto">
        <header className="flex items-end gap-6">
          <div className="flex-1">
            <div className="text-sm text-ink-500">Fraud Ops <span className="mx-1">/</span> Scam call decoys</div>
            <h1 className="text-[28px] font-bold tracking-tight text-ink-900 leading-tight">
              Scammer Gets Scammed <span className="text-ink-400 font-medium">· Margaret, 78</span>
            </h1>
          </div>
          <div className="card flex items-center gap-4 px-5 py-3">
            <div className="h-11 w-11 rounded-full bg-teal-50 text-teal-600 grid place-items-center text-xl" aria-hidden="true">☎</div>
            <div>
              <div className="eyebrow">Call Margaret</div>
              <div className="text-[28px] font-bold font-mono tracking-wide text-navy-900 leading-tight">{data?.phone}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 pb-1">
            <StatusPill session={s} clock={clock} />
            <button onClick={() => post("/api/reset")} className="btn-ghost py-1.5">Reset demo</button>
          </div>
        </header>

        {tab === "live" && (
          <>
            <KpiRow s={s} clock={clock} />
            <Stepper s={sModel} />
            <main className="flex-1 grid grid-cols-12 gap-4 min-h-0">
              <div className="col-span-5 min-h-0 flex flex-col"><Transcript s={s} /></div>
              <div className="col-span-4 min-h-0 flex flex-col">
                <Controls data={data} onApprove={() => post("/api/approve")} onSar={() => setShowSar(true)} />
              </div>
              <div className="col-span-3 min-h-0 flex flex-col gap-4"><Intel s={s} /><Accounts s={s} /></div>
            </main>
          </>
        )}
        {tab === "model" && <div className="flex-1 min-h-0 overflow-y-auto scroll-thin"><ModelTab /></div>}
        {tab === "audit" && <div className="flex-1 min-h-0 overflow-y-auto scroll-thin"><AuditTab s={s} /></div>}
      </div>

      {flash && (
        <div className="fixed inset-0 pointer-events-none z-30 flex items-start justify-center pt-28 animate-flash">
          <div className="absolute inset-0 bg-red-600/10" />
          <div className="relative bg-white rounded-2xl shadow-2xl border-t-[6px] border-red-600 px-12 py-7 text-center min-w-[520px]">
            <div className="text-red-600 text-sm font-bold tracking-[0.2em]">MULE ACCOUNT BLOCKED</div>
            <div className="text-[64px] leading-none font-bold text-teal-600 mt-3">{money(s?.impact?.protected_total)}</div>
            <div className="text-ink-500 mt-2">protected or in recovery for Bay Federal members</div>
          </div>
        </div>
      )}

      {showSar && s?.sar?.markdown && (
        <Modal wide onClose={() => setShowSar(false)}>
          <pre className="whitespace-pre-wrap font-sans text-ink-700 text-[15px] leading-relaxed">{s.sar.markdown}</pre>
        </Modal>
      )}

      {tab === "live" && s?.summary && !hideSummary && (
        <Modal onClose={() => setHideSummary(true)}>
          <div className="eyebrow">Call summary</div>
          <div className="text-2xl font-bold text-ink-900 mt-1">The scammer got scammed.</div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {[["Scammer's time wasted", clock, "text-ink-900"],
              ["Mule accounts blocked", s.summary.mule_accounts, "text-red-600"],
              ["Protected or in recovery", money(s.summary.protected_total), "text-teal-600"],
              ["Real customer data shared", s.summary.real_data_shared, "text-ink-900"]].map(([k, v, tone]) => (
              <div key={k} className="rounded-2xl bg-navy-50 p-6">
                <div className={`text-5xl font-bold tracking-tight ${tone}`}>{v}</div>
                <div className="text-ink-500 mt-2">{k}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
