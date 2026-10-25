import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppSwitcher, GATE_LABELS, Modal, STAGE_NAMES, STAGE_WORDS, markSeen, money, post, threshold, useApi, useOutside } from "./App.jsx";

// CalHacks Federal Fraud Ops (#/bank): the bank's own internal tool. Our system is one "seat" inside it.

const ANALYST = "J. Rivera";

// ---------- formatting ----------

const fmtTime = (iso) => (iso ? String(iso).slice(11, 19) : "");
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + (String(iso).length > 10 ? ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
};
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const ago = (iso) => {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

// ---------- lozenges ----------

const LOZ = {
  BLOCKED: "bg-bf-red text-white", HELD: "bg-bf-green text-white", "PENDING REVIEW": "bg-bf-amber text-bf-ink",
  "RECALL REQUESTED": "bg-bf-blue text-white", ACTIVE: "bg-bf-line text-[#42526E]", FROZEN: "bg-bf-navy text-white",
  NEW: "bg-bf-line text-[#42526E]", "AWAITING APPROVAL": "bg-bf-amber text-bf-ink", CONFIRMED: "bg-bf-green text-white",
  REJECTED: "bg-[#FFEBE6] text-[#BF2600] ring-1 ring-[#FFBDAD]", "NO ACTION": "bg-bf-bg text-bf-sub ring-1 ring-bf-line",
  PROVISIONAL: "bg-bf-amber text-bf-ink", COMPLETED: "bg-bf-bg text-bf-sub ring-1 ring-bf-line",
  RELEASED: "bg-bf-bg text-bf-sub ring-1 ring-bf-line", LIVE: "bg-bf-red text-white",
};
const TRANSFER = { pending: "PENDING REVIEW", held: "HELD", recall_requested: "RECALL REQUESTED", completed: "COMPLETED", released: "RELEASED" };
export const Lozenge = ({ s, className = "" }) => {
  const k = String(s || "").toUpperCase();
  return <span className={`inline-block whitespace-nowrap rounded-[3px] px-1.5 py-[1px] text-[clamp(11px,0.62vw,12.5px)] font-bold uppercase tracking-[0.02em] ${LOZ[k] || LOZ.ACTIVE} ${className}`}>{k}</span>;
};

// ---------- icons ----------

const PATHS = {
  overview: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  cases: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
  members: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 100-6M22 21c0-3-2-5-5-5.5",
  payments: "M3 6h18v12H3zM3 10h18M7 15h4",
  blocklist: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 8.5l7 7",
  audit: "M12 7v5l3 2M12 3a9 9 0 110 18 9 9 0 010-18z",
  model: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5",
};
const Icon = ({ name, className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
);

function Logo() {
  return (
    <a href="#/bank/overview" className="flex items-center gap-2.5 shrink-0">
      <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true">
        <path d="M2 6 L17 1 L32 6" stroke="#E31837" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M2 13 L17 8 L32 13" stroke="#012169" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M2 20 L17 15 L32 20" stroke="#012169" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <div className="leading-[1.05]">
        <div className="text-bf-navy font-extrabold text-[17px] tracking-tight">CalHacks Federal</div>
        <div className="text-bf-sub text-[10px] font-bold tracking-[0.14em]">FRAUD OPS</div>
      </div>
    </a>
  );
}

const ACTOR = {
  scamwatch: ["AI", "bg-bf-navy text-white", "MargaretSGS seat"],
  rules: ["⚙", "bg-[#DEEBFF] text-bf-blue", "Payment rules"],
  analyst: ["JR", "bg-bf-green text-white", ANALYST],
  system: ["⟳", "bg-bf-line text-bf-sub", "System"],
  creao: ["CI", "bg-[#EAE6FF] text-[#403294] ring-1 ring-[#C0B6F2]", "MargaretSGS Investigator"],
};
const gateLabel = (k, data) => k === "scam_score" ? `Scam score ≥ ${threshold(data).toFixed(2)}`
  : k === "pressure_stages" && data?.gate?.min_pressure != null ? `${GATE_LABELS[k]} (≥ ${data.gate.min_pressure})` : GATE_LABELS[k] || k;
const ActorIcon = ({ actor, size = "h-7 w-7 text-[11px]" }) => {
  const [t, cls] = ACTOR[actor] || ACTOR.system;
  return <span className={`${size} shrink-0 rounded-full grid place-items-center font-bold ${cls}`}>{t.length === 1 ? <span className="text-[1.45em] leading-none">{t}</span> : t}</span>;
};

function describe(r) {
  const d = r.details || {};
  const acct = (a) => (a ? `••${String(a).split("/").pop().slice(-4)}` : "");
  switch (r.action) {
    case "gate_decision": return d.passed ? `Gate passed for ${acct(d.account)}: all 5 checks` : `Gate held back on ${acct(d.account)}: not blocked`;
    case "blocklist_provisional": return `Blocklisted ${acct(d.number)} (provisional)`;
    case "transfer_held": return d.reason ? `Held ${money(d.amount)} wire from ${d.customer}: ${d.reason}` : `Held ${money(d.amount)} wire from ${d.customer}`;
    case "recall_requested": return `Recall requested: ${money(d.amount)} from ${d.customer}, ${d.days_ago}d ago`;
    case "mule_account_held_for_review": return `Mule account ${acct(d.number)} held for review`;
    case "receiving_bank_notified_simulated": return `Notified ${d.bank} of mule account`;
    case "freeze_approved": return "Freeze approved, blocks confirmed";
    case "freeze_rejected": return `Freeze rejected: “${d.reason}”`;
    case "hold_released": return `Released hold on payment #${d.transfer_id}`;
    case "safe_account_phrase": return "Heard a “safe account” request";
    case "demo_reset": return "Ledger loaded";
    case "webhook_sent": return "Case webhook delivered";
    case "webhook_failed": return "Case webhook failed";
    case "investigation_started": return "Investigator started tracing the mule ring";
    case "investigation_completed": return `Investigation complete: ${d.linked_mules ?? 0} linked mule account${d.linked_mules === 1 ? "" : "s"}, ${d.victims ?? 0} more victim${d.victims === 1 ? "" : "s"}${d.cached ? (d.run_id && d.run_id !== "cached" ? ` (from CREAO run ${String(d.run_id).slice(0, 8)})` : " (cached)") : ""}`;
    case "investigation_failed": return `Investigation failed${d.error ? `: ${String(d.error).slice(0, 80)}` : ""}`;
    case "agent_finding_approved": return `Approved investigator finding: blocked ${acct(d.account)}${d.why ? `: ${d.why}` : ""}`;
    default: return r.action.replaceAll("_", " ");
  }
}

// ---------- layout ----------

const NAV = [["overview", "Overview"], ["cases", "Cases"], ["members", "Members"], ["payments", "Payments"],
  ["blocklist", "Blocklist"], ["audit", "Audit log"], ["model", "Model"]];

function TopBar({ page, data, connected }) {
  const [q, setQ] = useState("");
  const top = [["overview", "Your work"], ["cases", "Cases"], ["members", "Members"], ["model", "Reports"]];
  return (
    <header className="shrink-0 bg-white border-b border-bf-line">
      <div className="h-[3px] bg-gradient-to-r from-bf-navy via-bf-navy to-bf-red" />
      <div className="h-14 px-4 flex items-center gap-6">
        <Logo />
        <nav className="flex h-14">
          {top.map(([k, l]) => (
            <a key={k} href={`#/bank/${k}`} className={`px-3 h-full flex items-center text-[15px] font-semibold border-b-[3px] ${
              page === k ? "border-bf-navy text-bf-navy" : "border-transparent text-bf-sub hover:text-bf-ink"}`}>{l}</a>
          ))}
        </nav>
        <form className="relative flex-1 max-w-sm" onSubmit={(e) => { e.preventDefault(); location.hash = `#/bank/members?q=${encodeURIComponent(q)}`; }}>
          <Icon name="search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-bf-sub" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members"
            className="w-full h-9 rounded-[4px] border-2 border-bf-line bg-bf-bg pl-9 pr-3 text-sm outline-none focus:border-bf-blue focus:bg-white" />
        </form>
        <div className="flex-1" />
        {!connected && <span className="text-bf-amber text-xs font-bold">Reconnecting…</span>}
        <AppSwitcher current="bank" />
        <div className="flex items-center gap-2">
          <div className="text-right leading-tight hidden xl:block">
            <div className="text-sm font-semibold text-bf-ink">{ANALYST}</div>
            <div className="text-xs text-bf-sub">Fraud analyst</div>
          </div>
          <span className="h-9 w-9 rounded-full bg-bf-green text-white grid place-items-center text-sm font-bold">JR</span>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ page, badge }) {
  return (
    <aside className="shrink-0 w-14 2xl:w-60 bg-bf-bg border-r border-bf-line flex flex-col py-3">
      <div className="px-3 2xl:px-4 pb-3 mb-2 border-b border-bf-line flex items-center gap-3">
        <span className="h-8 w-8 shrink-0 rounded bg-bf-red text-white grid place-items-center font-bold text-sm">FO</span>
        <div className="hidden 2xl:block leading-tight">
          <div className="text-sm font-bold text-bf-ink">Fraud Ops</div>
          <div className="text-xs text-bf-sub">Payments controls</div>
        </div>
      </div>
      {NAV.map(([k, l]) => (
        <a key={k} href={`#/bank/${k}`} title={l}
          className={`relative mx-2 my-0.5 flex items-center gap-3 rounded-[4px] px-2.5 py-2 text-[15px] font-semibold ${
            page === k ? "bg-[#DEEBFF] text-bf-blue" : "text-[#42526E] hover:bg-bf-hover"}`}>
          <Icon name={k} />
          <span className="hidden 2xl:inline">{l}</span>
          {badge[k] > 0 && <span className="absolute top-1 left-7 2xl:static 2xl:ml-auto rounded-full bg-bf-red text-white text-[11px] font-bold min-w-[18px] h-[18px] px-1 grid place-items-center">{badge[k]}</span>}
        </a>
      ))}
    </aside>
  );
}

function PageHead({ crumbs, title, right, sub }) {
  return (
    <div className="flex items-start gap-6 mb-[clamp(10px,1vw,18px)]">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-bf-sub">
          {crumbs.map(([l, h], i) => <span key={i}>{i > 0 && <span className="mx-1.5">/</span>}{h ? <a href={h} className="hover:underline">{l}</a> : l}</span>)}
        </div>
        <h1 className="text-[clamp(22px,1.6vw,30px)] font-bold text-bf-ink tracking-tight leading-tight mt-0.5">{title}</h1>
        {sub && <div className="text-sm text-bf-sub mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function DotMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Gadget menu" className="h-7 w-7 rounded-[3px] text-bf-sub hover:bg-bf-hover grid place-items-center text-lg leading-none">…</button>
      {open && (
        <div className="absolute right-0 top-8 z-30 min-w-[220px] rounded-[4px] bg-white shadow-lg ring-1 ring-bf-line py-1">
          {items.map(([l, fn]) => (
            <button key={l} onClick={() => { setOpen(false); typeof fn === "string" ? (location.hash = fn) : fn(); }}
              className="block w-full text-left px-4 py-2 text-sm text-bf-ink hover:bg-bf-bg">{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const Gadget = ({ title, menu, children, className = "", bodyClass = "p-4", right }) => (
  <section className={`bg-white rounded-[4px] border border-bf-line shadow-[0_1px_1px_rgba(9,30,66,0.13)] flex flex-col min-h-0 ${className}`}>
    <div className="flex items-center gap-2 px-4 pt-3 pb-2">
      <h2 className="text-[clamp(14px,0.85vw,16px)] font-bold text-bf-ink flex-1 truncate">{title}</h2>
      {right}
      {menu && <DotMenu items={menu} />}
    </div>
    <div className={`flex-1 min-h-0 ${bodyClass}`}>{children}</div>
  </section>
);

const Btn = ({ kind = "default", className = "", ...p }) => {
  const k = {
    primary: "bg-bf-navy text-white hover:bg-bf-navy2", danger: "bg-bf-red text-white hover:brightness-95",
    default: "bg-bf-line/70 text-bf-ink hover:bg-bf-line", subtle: "text-bf-sub hover:bg-bf-hover",
  }[kind];
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-[3px] px-3.5 py-2 text-[clamp(13px,0.75vw,15px)] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${k} ${className}`} />;
};

const Th = ({ children, onClick, active, dir, className = "" }) => (
  <th onClick={onClick} className={`text-left font-bold text-bf-sub text-[12px] uppercase tracking-wide px-3 py-2 border-b-2 border-bf-line whitespace-nowrap ${onClick ? "cursor-pointer select-none hover:text-bf-ink" : ""} ${className}`}>
    {children}{active && <span className="ml-1">{dir > 0 ? "↑" : "↓"}</span>}
  </th>
);
const tdc = "px-3 py-2 border-b border-bf-line text-[clamp(13px,0.8vw,15px)] text-bf-ink";

function Toast({ msg, onDone }) {
  useEffect(() => { if (msg) { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-[4px] shadow-xl px-5 py-3 text-[15px] font-semibold max-w-[720px] ${msg.error ? "bg-[#FFEBE6] text-[#BF2600]" : "bg-bf-ink text-white"}`}>{msg.text}</div>
  );
}

// ---------- seat card ----------

function SeatCard() {
  const can = [["Place reversible holds", true], ["Request recalls", true], ["Draft SARs", true],
    ["Freeze accounts (needs an analyst)", false], ["Move money", false], ["See full member data", false]];
  return (
    <div className="shrink-0 bg-white rounded-[4px] border border-bf-line border-l-[4px] border-l-bf-navy px-4 py-2.5 shadow-[0_1px_1px_rgba(9,30,66,0.13)] max-w-[560px]">
      <div className="flex items-center gap-2">
        <ActorIcon actor="scamwatch" size="h-6 w-6 text-[10px]" />
        <div className="text-[clamp(13px,0.8vw,15px)] font-bold text-bf-ink">AI seat: Fraud Intelligence Analyst + Payments Controls Officer</div>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1.5">
        {can.map(([l, ok]) => (
          <li key={l} className={`text-[clamp(12px,0.72vw,14px)] flex items-center gap-1.5 ${ok ? "text-bf-ink" : "text-bf-sub"}`}>
            <b className={ok ? "text-bf-green" : "text-bf-red"}>{ok ? "✓" : "✗"}</b>{l}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- overview ----------

function useFlips(rows, callId) {
  const [fresh, setFresh] = useState({});
  const sig = rows.map((r) => `${r.transfer_id}:${r.status}`).join(",");
  useEffect(() => {
    const seen = new Set(JSON.parse(sessionStorage.getItem("bf_flips") || "[]"));
    const add = rows.filter((r) => r.status === "held" && !seen.has(`${callId}:${r.transfer_id}`));
    if (!add.length) return;
    add.forEach((r) => seen.add(`${callId}:${r.transfer_id}`));
    sessionStorage.setItem("bf_flips", JSON.stringify([...seen].slice(-300)));
    setFresh((f) => ({ ...f, ...Object.fromEntries(add.map((r) => [r.transfer_id, true])) }));
    setTimeout(() => setFresh((f) => { const n = { ...f }; add.forEach((r) => delete n[r.transfer_id]); return n; }), 1800);
  }, [sig, callId]);
  return fresh;
}

function FlipLozenge() {
  const [held, setHeld] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHeld(true), 650); return () => clearTimeout(t); }, []);
  return held ? <Lozenge s="HELD" className="animate-pop" /> : <Lozenge s="PENDING REVIEW" />;
}

const ORDER = { held: 0, recall_requested: 1, pending: 2 };

function WatchTable({ data, onSimulate }) {
  const rows = [...(data?.ledger?.watch || [])].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || b.amount - a.amount);
  const fresh = useFlips(rows, data?.session?.call?.id || "none");
  return (
    <Gadget title="Payments under watch" className="col-span-5" bodyClass="overflow-y-auto scroll-thin px-2 pb-2"
      right={<span className="text-xs text-bf-sub">{data?.ledger?.customers || 0} members monitored</span>}
      menu={[["Open payments", "#/bank/payments"], ["Simulate: new wire next week", onSimulate]]}>
      <table className="w-full">
        <thead className="sticky top-0 bg-white"><tr><Th>Member</Th><Th className="text-right">Amount</Th><Th>Destination</Th><Th>Status</Th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className={`${tdc} text-center text-bf-sub py-6`}>No payments under watch.</td></tr>}
          {rows.map((t) => (
            <tr key={t.transfer_id} className={fresh[t.transfer_id] ? "animate-flipRow" : t.status === "held" ? "bg-[#E3FCEF]/60" : ""}>
              <td className={`${tdc} whitespace-nowrap`}><span className="font-semibold">{t.customer}</span> <span className="text-bf-sub">· {t.age}</span></td>
              <td className={`${tdc} text-right font-semibold tabular-nums`}>{money(t.amount)}</td>
              <td className={`${tdc} text-bf-sub`}><div className="truncate max-w-[clamp(110px,9vw,230px)]">{t.to}</div><div className="text-[12px] truncate max-w-[clamp(110px,9vw,230px)] [@media(max-height:820px)]:hidden">“{t.memo}”</div></td>
              <td className={`${tdc} whitespace-nowrap`}>{fresh[t.transfer_id] ? <FlipLozenge /> : <Lozenge s={TRANSFER[t.status]} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Gadget>
  );
}

function Donut({ counts }) {
  const segs = [["New", "#97A0AF"], ["Awaiting approval", "#FF991F"], ["Confirmed", "#00875A"], ["Rejected", "#E31837"], ["No action", "#DFE1E6"]]
    .map(([k, c]) => [k, c, counts?.[k] || 0]).filter(([k, , n]) => n || k !== "No action");
  const total = segs.reduce((t, s) => t + s[2], 0) || 1;
  const C = 2 * Math.PI * 38;
  let off = 0;
  return (
    <div className="flex items-center gap-4 h-full">
      <svg viewBox="0 0 100 100" className="h-[clamp(84px,6.5vw,124px)] w-[clamp(84px,6.5vw,124px)] -rotate-90 shrink-0">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#F4F5F7" strokeWidth="16" />
        {segs.map(([k, c, n]) => {
          const len = (n / total) * C;
          const el = <circle key={k} cx="50" cy="50" r="38" fill="none" stroke={c} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} className="transition-all duration-700" />;
          off += len;
          return el;
        })}
        <text x="50" y="50" className="rotate-90" style={{ transformOrigin: "50px 50px" }} textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="#172B4D">{total}</text>
      </svg>
      <ul className="space-y-1 text-[clamp(12px,0.75vw,14px)]">
        {segs.map(([k, c, n]) => (
          <li key={k} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /><span className="text-bf-ink">{k}</span><b className="ml-auto pl-3 tabular-nums">{n}</b></li>
        ))}
      </ul>
    </div>
  );
}

function RejectModal({ onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const submit = () => post("/api/reject", { reason }).then(() => { onDone("Freeze rejected. Blocks stay provisional; holds stay until released."); onClose(); }).catch((e) => setErr(e.message));
  return (
    <Modal onClose={onClose}>
      <div className="text-xl font-bold text-bf-ink">Reject freeze</div>
      <p className="text-bf-sub mt-1 text-[15px]">Blocklist entries stay <b>provisional</b> and holds stay in place until an analyst releases them. This is written to the audit log.</p>
      <label className="block mt-4 text-sm font-bold text-bf-ink">Reason <span className="text-bf-red">*</span></label>
      <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Account owner called in; verifying identity before freezing"
        className="mt-1 w-full rounded-[3px] border-2 border-bf-line p-2 text-[15px] outline-none focus:border-bf-blue" />
      {err && <div className="text-[#BF2600] text-sm mt-1">{err}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn kind="subtle" onClick={onClose}>Cancel</Btn>
        <Btn kind="danger" disabled={!reason.trim()} onClick={submit}>Reject freeze</Btn>
      </div>
    </Modal>
  );
}

// "Phantom hacker · Federal Reserve impostor" → "phantom hacker fraud"
const fraudType = (summary) => {
  const t = String(summary || "").split(" · ")[0].trim();
  return !t || /decoy call/i.test(t) ? "scam call fraud" : `${t.toLowerCase()} fraud`;
};

/** One line for the analyst ("5/5 flags · likely phantom hacker fraud"); the individual checks only on request. */
function FlagSummary({ checks, summary, blocked = true, detailed, footnote }) {
  const [open, setOpen] = useState(false);
  const passed = checks.filter((c) => c.passed).length;
  const all = checks.length > 0 && passed === checks.length;
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 text-left group">
        <span className={`h-6 min-w-[44px] px-1.5 rounded-[3px] grid place-items-center text-[12px] font-bold ${all ? "bg-bf-red text-white" : "bg-bf-line text-bf-ink"}`}>{passed}/{checks.length}</span>
        <span className="font-semibold text-bf-ink text-[clamp(13px,0.8vw,15px)] leading-snug flex-1">
          {all ? <>flags checked · likely <span className="text-bf-red">{fraudType(summary)}</span></> : <>flags · {blocked ? "partial match" : "not enough to block"}</>}
        </span>
        <span className="text-[12px] text-bf-blue font-semibold whitespace-nowrap group-hover:underline">{open ? "Hide checks ▴" : "Show checks ▾"}</span>
      </button>
      {open && (
        detailed ? (
          <table className="w-full mt-2"><tbody>
            {checks.map((w) => (
              <tr key={w.label}>
                <td className={`${tdc} w-8`}><b className={w.passed ? "text-bf-green" : "text-bf-red"}>{w.passed ? "✓" : "✗"}</b></td>
                <td className={`${tdc} font-semibold w-64`}>{w.label}</td>
                <td className={`${tdc} text-bf-sub`}>{w.data}</td>
              </tr>
            ))}
          </tbody></table>
        ) : (
          <ul className="mt-1.5 ml-1 space-y-0.5 text-[clamp(12px,0.72vw,14px)]">
            {checks.map((w) => <li key={w.label} className="text-bf-ink"><b className={w.passed ? "text-bf-green" : "text-bf-red"}>{w.passed ? "✓" : "✗"}</b> {w.label}</li>)}
          </ul>
        )
      )}
      {open && footnote && <div className="text-[12.5px] text-bf-sub mt-2">{footnote}</div>}
    </div>
  );
}

/** What approving the freeze locks in, in member terms. */
function FreezeImpact({ s, inv, compact }) {
  const imp = s?.impact;
  if (!imp) return null;
  const people = [...imp.holds, ...imp.lookback];
  const members = [...new Map(people.map((p) => [p.customer, p])).values()];
  const ages = members.map((m) => m.age).filter(Boolean);
  const held = imp.holds.reduce((t, h) => t + h.amount, 0);
  const recall = imp.lookback.reduce((t, h) => t + h.amount, 0);
  const internal = (s.accounts || []).filter((a) => a.status === "blocked" && a.result?.internal);
  const ring = inv?.status === "completed" ? inv.findings?.totals?.stoppable_pending_usd || 0 : 0;
  const decided = imp.freeze_approved || imp.freeze_rejected;
  const who = (list) => [...new Map(list.map((p) => [p.customer, p])).values()].map((p) => `${p.customer.split(" ")[0]}, ${p.age}`).join(" · ");
  return (
    <div className="mt-2 rounded-[4px] bg-[#E3FCEF] border border-[#ABF5D1] px-3 py-2">
      <div className="text-[clamp(13px,0.85vw,16px)] text-bf-ink leading-snug">
        <b>{imp.freeze_approved ? "Locked in" : "Approving locks in"} <span className="text-bf-green">{money(imp.protected_total)}</span></b>
        {members.length > 0 && <> for {members.length} member{members.length > 1 ? "s" : ""}{ages.length ? ` aged ${Math.min(...ages)}–${Math.max(...ages)}` : ""}</>}
      </div>
      <ul className={`mt-1 space-y-0.5 text-[clamp(12px,0.72vw,14px)] text-bf-ink ${compact ? "" : ""}`}>
        {held > 0 && <li><b className="text-bf-green">{money(held)}</b> wire stays with {who(imp.holds)}</li>}
        {recall > 0 && <li><b className="text-bf-blue">{money(recall)}</b> recall for {who(imp.lookback)}</li>}
        {internal.length > 0 && <li>Mule {internal.map((a) => `••${a.number.slice(-4)}`).join(", ")} frozen: no other senior can wire it</li>}
        {ring > 0 && !decided && <li>Investigator: <b>{money(ring)}</b> more is still stoppable in the ring</li>}
      </ul>
    </div>
  );
}

function Decision({ s, caseKey, detail, toast, compact, data }) {
  const [rejecting, setRejecting] = useState(false);
  const blocked = (s?.accounts || []).filter((a) => a.status === "blocked");
  const imp = s?.impact;
  if (!blocked.length) return <div className="h-full grid place-items-center text-center text-bf-sub text-[15px] px-4">Nothing is waiting for you.<br />Freeze requests from the AI seat land here.</div>;
  const internal = blocked.filter((a) => a.result?.internal);
  const disc = detail?.accounts?.find((a) => a.discrepancy)?.discrepancy;
  const approve = () => post("/api/approve").then(() => toast("Freeze approved. Provisional blocks confirmed and audited.")).catch((e) => toast(e.message, true));
  const checks = Object.entries(blocked[0].gate || {}).map(([k, ok]) => ({ label: gateLabel(k, data), passed: ok }));
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2">
        <a href={`#/bank/cases/${caseKey}`} className="text-bf-blue font-semibold text-sm hover:underline">{caseKey}</a>
        <Lozenge s={imp.freeze_approved ? "CONFIRMED" : imp.freeze_rejected ? "REJECTED" : "AWAITING APPROVAL"} />
      </div>
      <div className="font-bold text-bf-ink text-[clamp(14px,0.9vw,17px)] mt-1 leading-snug">
        Confirm {blocked.length} provisional block{blocked.length > 1 ? "s" : ""}{internal.length ? ` and freeze ${internal.map((a) => `••${a.number.slice(-4)}`).join(", ")} at CalHacks Federal` : ""}
      </div>
      <div className={`mt-2 ${compact ? "" : "flex-1 min-h-0 overflow-y-auto scroll-thin pr-1"}`}>
        <FlagSummary checks={checks} summary={detail?.summary} />
        {disc && <div className="text-[clamp(12px,0.72vw,14px)] text-bf-ink mt-1.5 rounded-[3px] bg-[#FFFAE6] px-2 py-1"><b className="text-[#974F0C]">Sources disagree:</b> memo says {disc.claimed}; routing resolves to a private {disc.facts[0].says.split("a private ")[1]}</div>}
        <FreezeImpact s={s} inv={s?.investigation} compact={compact} />
      </div>
      <div className="mt-3">
        {imp.freeze_approved ? <div className="text-bf-green font-bold text-[15px]">✓ Approved by {ANALYST}</div>
          : imp.freeze_rejected ? <div className="text-[#BF2600] text-[14px]"><b>Rejected by {ANALYST}:</b> “{imp.reject_reason}”</div>
          : <div className="flex gap-2"><Btn kind="primary" className="flex-1" onClick={approve}>Approve freeze</Btn><Btn className="flex-1" onClick={() => setRejecting(true)}>Reject</Btn></div>}
      </div>
      {rejecting && <RejectModal onClose={() => setRejecting(false)} onDone={toast} />}
    </div>
  );
}

// ---------- MargaretSGS Investigator (CREAO) ----------

const STEPS_INV = [["queued", "Queued"], ["running", "Running"], ["completed", "Done"]];
const mask = (n) => `••${String(n || "").slice(-4)}`;

// Provenance of findings loaded from a saved run: "CREAO run 375a92a6 · 27 min · full ledger".
function RunTag({ inv }) {
  const c = inv?.cached_from;
  if (!c?.run_id) return <span className="rounded-[3px] bg-bf-line px-1.5 text-[11px] font-semibold text-bf-sub">cached</span>;
  const when = c.finished_at ? new Date(c.finished_at * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
  return (
    <span title={`Findings from CREAO run ${c.run_id}${when ? `, finished ${when}` : ""}. The demo ledger is reseeded identically, so they describe this same ring.`}
      className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#EAE6FF] text-[#403294] ring-1 ring-[#C0B6F2] px-1.5 py-[1px] text-[11px] font-semibold whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full bg-[#6554C0]" />
      CREAO run <span className="font-mono">{String(c.run_id).slice(0, 8)}</span>
      {c.minutes != null && <> · {Math.round(c.minutes)} min</>} · full ledger
    </span>
  );
}

function InvStepper({ status, elapsed, cached, inv }) {
  const at = status === "completed" ? 2 : status === "running" ? 1 : status === "queued" ? 0 : -1;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS_INV.map(([k, l], i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className={`h-[2px] w-3 ${i <= at ? "bg-bf-navy" : "bg-bf-line"}`} />}
          <span className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-[1px] text-[11px] font-bold uppercase tracking-[0.02em] whitespace-nowrap ${
            i < at || (i === at && k === "completed") ? "bg-bf-navy text-white" : i === at ? "bg-bf-amber text-bf-ink" : "bg-bf-bg text-bf-sub ring-1 ring-bf-line"}`}>
            {i === at && k !== "completed" && <span className="h-1.5 w-1.5 rounded-full bg-bf-ink animate-pulse" />}{l}
            {i === at && k === "running" && elapsed != null && <span className="tabular-nums font-semibold normal-case">· {elapsed}s</span>}
          </span>
        </React.Fragment>
      ))}
      {cached && status === "completed" && <RunTag inv={inv} />}
    </div>
  );
}

function useInvestigator(data, toast) {
  const s = data?.session;
  const inv = s?.investigation || null;
  const blocked = (s?.accounts || []).some((a) => a.status === "blocked");
  const [local, setLocal] = useState(null); // {t0, call} while we show "running" before findings arrive
  const [now, setNow] = useState(Date.now() / 1000);
  const fb = useRef(false);
  const tried = useRef(null);
  const callId = s?.call?.id;
  const st = inv?.status;
  const busy = (local && local.call === callId) || st === "queued" || st === "running";
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setNow(Date.now() / 1000), 500);
    return () => clearInterval(t);
  }, [busy]);
  const fallback = () => {
    if (fb.current) return;
    fb.current = true;
    post("/api/creao/fallback").catch((e) => { toast(`Investigator: ${e.message}`, true); setLocal(null); })
      .finally(() => { fb.current = false; });
  };
  useEffect(() => {
    if (!blocked) return;
    const once = (k) => { if (tried.current === k) return; tried.current = k; fallback(); };
    if (st === "failed") { once(`f:${callId}:${inv?.run_id}`); return; }
    if (st === "completed") { if (local && !fb.current) setLocal(null); return; }
    const t0 = local?.t0 || inv?.started_at;
    if (t0 && now - t0 > 20) once(`t:${callId}:${local?.t0 || inv?.run_id}`);
  }, [st, now, blocked]);
  const run = () => {
    setLocal({ t0: Date.now() / 1000, call: callId });
    setNow(Date.now() / 1000);
    post("/api/creao/run").then((r) => { if (r?.status === "failed") setTimeout(fallback, 1800); })
      .catch(() => setTimeout(fallback, 1800));
  };
  const mine = local && local.call === callId;
  const status = st === "failed" && blocked ? "running" : mine && st !== "running" && st !== "queued" ? "running" : st && st !== "failed" && st !== "none" ? st : null;
  const t0 = inv?.started_at && st !== "completed" ? inv.started_at : local?.t0;
  const elapsed = status === "running" && t0 ? Math.max(0, Math.floor(now - t0)) : null;
  return { inv, blocked, status, elapsed, run, done: status === "completed", enabled: data?.creao_enabled };
}

function MuleRow({ m, approved, toast, compact }) {
  const [busy, setBusy] = useState(false);
  const approve = () => {
    setBusy(true);
    post("/api/creao/approve_block", { routing: m.routing, number: m.number })
      .then((r) => toast(`Blocked ${m.bank} ${mask(m.number)}. ${r.holds?.length || 0} payment${r.holds?.length === 1 ? "" : "s"} held, ${r.lookback?.length || 0} sent to recall.`))
      .catch((e) => (/already approved/i.test(e.message) ? null : toast(e.message, true)))
      .finally(() => setBusy(false));
  };
  return (
    <div className={`flex items-start gap-2 ${compact ? "py-1.5" : "py-2.5"} border-b border-bf-line last:border-b-0`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-bf-ink text-[clamp(12px,0.75vw,14px)]">{[...new Set(String(m.bank || "").split(" · "))].join(" · ")} {mask(m.number)}</span>
          <span className="font-mono text-[11px] text-bf-sub">{m.routing}/{m.number}</span>
          {m.confidence && <span className={`rounded-[3px] px-1 text-[10.5px] font-bold uppercase ${m.confidence === "high" ? "bg-[#FFEBE6] text-[#BF2600]" : "bg-[#FFFAE6] text-[#974F0C]"}`}>{m.confidence}</span>}
          {approved && <Lozenge s="BLOCKED" />}
        </div>
        <div className={`text-bf-sub leading-snug ${compact ? "text-[12px] line-clamp-2" : "text-[13.5px] mt-0.5"}`}>{m.why}</div>
      </div>
      <div className="shrink-0 pt-0.5">
        {approved ? <span className="text-bf-green font-bold text-[13px] whitespace-nowrap">✓ Blocked</span>
          : <Btn kind="danger" className="!px-2.5 !py-1 !text-[12.5px]" disabled={busy} onClick={approve}>{busy ? "Blocking…" : "Approve block"}</Btn>}
      </div>
    </div>
  );
}

function InvFindings({ inv, toast, compact }) {
  const f = inv.findings || {};
  const tot = f.totals || {};
  const approved = new Set(inv.approved || []);
  const victims = [...(f.additional_victims || [])].sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
  const pending = victims.filter((v) => v.status === "pending");
  const past = victims.filter((v) => v.status !== "pending");
  const atRisk = (f.at_risk_members || []).filter((r) => !pending.some((v) => v.member === r.member));
  const h3 = "text-[11px] font-bold uppercase tracking-wide text-bf-sub mt-3 mb-1";
  const [logic, setLogic] = useState(false);
  const nPending = new Set([...pending, ...atRisk].map((v) => v.member)).size;
  const nPast = new Set(past.map((v) => v.member)).size;
  const ages = victims.map((v) => v.age).filter(Boolean);
  const stoppable = tot.stoppable_pending_usd ?? pending.reduce((t, v) => t + v.amount, 0);
  const recallable = tot.recall_candidates_usd ?? past.reduce((t, v) => t + v.amount, 0);
  const vrow = (v, i) => (
    <div key={v.txn_id || i} className="flex items-center gap-2 py-1 border-b border-bf-line last:border-b-0 text-[clamp(12px,0.75vw,14px)]">
      <span className="font-semibold text-bf-ink truncate">{v.member}</span><span className="text-bf-sub">· {v.age}</span>
      {!compact && v.to && <span className="text-bf-sub text-[12px] truncate">→ {v.to}</span>}
      <span className="ml-auto text-bf-sub text-[12px] whitespace-nowrap">{v.date}</span>
      <span className="font-semibold tabular-nums w-[72px] text-right">{money(v.amount)}</span>
      <span className="w-[118px] text-right">{v.status === "pending" ? <Lozenge s="PENDING REVIEW" /> : <span className="inline-block rounded-[3px] px-1.5 py-[1px] text-[11px] font-bold uppercase bg-[#DEEBFF] text-bf-blue whitespace-nowrap">Recall candidate</span>}</span>
    </div>
  );
  return (
    <div>
      <div className={`text-bf-ink leading-snug ${compact ? "text-[13px]" : "text-[15px]"}`}>
        Found <b>{(f.linked_mule_accounts || []).length} more mule account{(f.linked_mule_accounts || []).length === 1 ? "" : "s"}</b> and{" "}
        <b>{new Set(victims.map((v) => v.member)).size} more victim{new Set(victims.map((v) => v.member)).size === 1 ? "" : "s"}</b>{ages.length ? ` aged ${Math.min(...ages)}–${Math.max(...ages)}` : ""}.
        {" "}Approve each block below to stop their money moving.
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {[["Still stoppable today", stoppable, "text-bf-green", `pending wires from ${nPending} member${nPending === 1 ? "" : "s"}`],
          ["Can be recalled", recallable, "text-bf-blue", `already sent by ${nPast} member${nPast === 1 ? "" : "s"}`],
          ["Total at risk", tot.exposed_usd ?? stoppable + recallable, "text-bf-red", "across the whole ring"]].map(([l, v, c, sub]) => (
          <div key={l} className="rounded-[3px] bg-bf-bg px-2 py-1.5 min-w-0">
            <div className="text-[11px] font-bold text-bf-ink truncate">{l}</div>
            <div className={`font-bold tabular-nums leading-none mt-0.5 ${compact ? "text-[clamp(15px,1vw,19px)]" : "text-[22px]"} ${c}`}>{money(v)}</div>
            <div className="text-[11px] text-bf-sub mt-0.5 truncate">{sub}</div>
          </div>
        ))}
      </div>
      {f.summary && (
        <div className="mt-1.5">
          <button onClick={() => setLogic(!logic)} className="text-[12px] text-bf-blue font-semibold hover:underline">{logic ? "Hide model logic ▴" : "View model logic ▾"}</button>
          {logic && <div className={`mt-1 rounded-[4px] bg-[#EAE6FF]/60 px-3 py-2 text-bf-ink leading-snug ${compact ? "text-[12.5px]" : "text-[14px]"}`}>{f.summary}</div>}
        </div>
      )}
      <div className={h3}>Other mule accounts in the ring · {(f.linked_mule_accounts || []).length}</div>
      {(f.linked_mule_accounts || []).map((m) => <MuleRow key={m.routing + m.number} m={m} approved={approved.has(`${m.routing}/${m.number}`)} toast={toast} compact={compact} />)}
      {(f.linked_mule_accounts || []).length === 0 && <div className="text-[13px] text-bf-sub">No other mule accounts found.</div>}
      {compact ? (
        <>
          <div className={h3}>Victims and amounts · {victims.length}</div>
          {victims.map(vrow)}
        </>
      ) : (
        <>
          <div className={h3}>Victims and amounts · {victims.length}</div>
          {victims.map(vrow)}
          <div className={h3}>Pending payments to hold · {money(stoppable)}</div>
          {pending.length === 0 && atRisk.length === 0 && <div className="text-[13px] text-bf-sub">None.</div>}
          {pending.map(vrow)}
          {atRisk.map((r, i) => <div key={i} className="text-[13.5px] py-1 border-b border-bf-line"><b>{r.member}</b> <span className="text-bf-sub">· {r.age} · {r.signal}</span></div>)}
          <div className={h3}>Past payments to review · {money(past.reduce((t, v) => t + v.amount, 0))}</div>
          {past.length === 0 && <div className="text-[13px] text-bf-sub">None.</div>}
          {past.map(vrow)}
          {(f.cleared_lookalikes || []).length > 0 && <>
            <div className={h3}>Cleared look-alikes</div>
            {f.cleared_lookalikes.map((c, i) => <div key={i} className="text-[13.5px] py-1"><b className="text-bf-green">✓</b> <b>{c.party}</b> <span className="text-bf-sub">· {c.why_not_fraud}</span></div>)}
          </>}
        </>
      )}
    </div>
  );
}

function Investigator({ data, toast, compact }) {
  const { inv, blocked, status, elapsed, run, done } = useInvestigator(data, toast);
  const head = (
    <div className="flex items-center gap-2 flex-wrap">
      {!status && <Btn kind="primary" className={compact ? "!py-1.5" : ""} disabled={!blocked} onClick={run}>Run investigator</Btn>}
      {status && <InvStepper status={status} elapsed={elapsed} cached={inv?.cached} inv={inv} />}
      {!status && <span className="text-[12.5px] text-bf-sub leading-snug flex-1 min-w-[140px]">{blocked
        ? "Traces the blocked account's money: other mules, more victims, payments still stoppable."
        : "Available once the live call has a blocked account."}</span>}
    </div>
  );
  return (
    <div className={compact ? "h-full flex flex-col min-h-0" : ""}>
      {head}
      {status && !done && <div className="mt-3 text-[13.5px] text-bf-sub leading-snug">Tracing payments in and out of the blocked account across the ledger, linking accounts and members…
        <div className="mt-2 h-1.5 rounded-full bg-bf-bg overflow-hidden"><div className="h-full w-1/3 bg-bf-navy rounded-full animate-pulse" /></div></div>}
      {done && inv?.findings && <div className={compact ? "mt-2 flex-1 min-h-0 overflow-y-auto scroll-thin pr-1" : "mt-3"}><InvFindings inv={inv} toast={toast} compact={compact} /></div>}
    </div>
  );
}

function Activity({ rows }) {
  return (
    <ul className="divide-y divide-bf-line">
      {(rows || []).map((r, i) => (
        <li key={i} className="flex gap-2.5 py-2 animate-pop">
          <ActorIcon actor={r.actor} />
          <div className="min-w-0 flex-1">
            <div className="text-[clamp(12px,0.75vw,14px)] text-bf-ink leading-snug">{describe(r)}</div>
            <div className="text-[11px] text-bf-sub">{(ACTOR[r.actor] || ACTOR.system)[2]} · {fmtTime(r.ts)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Overview({ data, toast, simulate }) {
  const [ov] = useApi("/api/bank/overview", data?.ts);
  const s = data?.session;
  const liveKey = ov?.live_case?.key;
  const [detail] = useApi(liveKey ? `/api/bank/cases/${liveKey}` : "/api/bank/cases/none", data?.ts);
  const watch = data?.ledger?.watch || [];
  const protectedNow = watch.filter((t) => t.status === "held" || t.status === "recall_requested").reduce((t, x) => t + x.amount, 0);
  const thisCall = s?.impact?.protected_total || 0;
  const b = ov?.blocked || { provisional: 0, confirmed: 0 };
  const big = "text-[clamp(30px,2.5vw,48px)] font-bold leading-none tracking-tight tabular-nums";
  const inv = s?.investigation;
  const liveBlocked = [...(s?.accounts || []).filter((a) => a.status === "blocked"),
    ...(inv?.findings?.linked_mule_accounts || []).filter((m) => (inv.approved || []).includes(`${m.routing}/${m.number}`))];
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Payments Controls Dashboard"]]} title="Payments Controls Dashboard" right={<SeatCard />} />
      <div className="grid grid-cols-12 gap-[clamp(8px,0.8vw,16px)]">
        <Gadget title="Money protected" className="col-span-4" menu={[["View payments", "#/bank/payments"]]}>
          <div className={`${big} ${protectedNow ? "text-bf-green" : "text-bf-sub/50"}`}>{money(protectedNow)}</div>
          <div className="text-[clamp(12px,0.75vw,14px)] text-bf-sub mt-1.5 flex items-center gap-2">
            {thisCall > 0 && <span className="rounded-[3px] bg-[#E3FCEF] text-bf-green font-bold px-1.5">+{money(thisCall)} this call</span>}
            held + recall requested
          </div>
        </Gadget>
        <Gadget title="Mule accounts blocked" className="col-span-4" menu={[["Open blocklist", "#/bank/blocklist"]]}>
          <div className="flex gap-4 min-w-0">
            <div className="shrink-0">
              <div className={`${big} text-bf-red`}>{b.provisional + b.confirmed}</div>
              <div className="text-[clamp(12px,0.75vw,14px)] text-bf-sub mt-1.5 flex flex-col gap-0.5">
                <span className="whitespace-nowrap"><Lozenge s="PROVISIONAL" /> {b.provisional}</span><span className="whitespace-nowrap"><Lozenge s="CONFIRMED" /> {b.confirmed}</span>
              </div>
            </div>
            <ul className="flex-1 min-w-0 border-l border-bf-line pl-3 space-y-1 max-h-[clamp(64px,6vw,96px)] overflow-y-auto scroll-thin">
              {liveBlocked.length === 0 && <li className="text-[12.5px] text-bf-sub">No account flagged on the live call yet.</li>}
              {liveBlocked.map((a) => (
                <li key={a.routing + a.number} className="animate-pop">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Lozenge s="BLOCKED" />
                    {liveKey && <a href={`#/bank/cases/${liveKey}`} className="text-bf-blue font-bold text-[12.5px] hover:underline">{liveKey}</a>}
                  </div>
                  <div className="text-[clamp(12px,0.72vw,14px)] text-bf-ink truncate"><span className="font-semibold">{a.bank}</span> <span className="font-mono">••{String(a.number).slice(-4)}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </Gadget>
        <Gadget title="Cases by status" className="col-span-4" bodyClass="px-4 pb-3" menu={[["Open cases", "#/bank/cases"]]}>
          <Donut counts={ov?.cases_by_status} />
        </Gadget>
      </div>
      <div className="flex-1 min-h-[300px] grid grid-cols-12 grid-rows-[minmax(0,1fr)] gap-[clamp(8px,0.8vw,16px)] mt-[clamp(8px,0.8vw,16px)]">
        <WatchTable data={data} onSimulate={simulate} />
        <Gadget title="MargaretSGS Investigator (CREAO)" className="col-span-4" bodyClass="px-4 pb-3 flex flex-col min-h-0"
          right={inv?.run_id && inv.run_id !== "cached" && !inv.cached ? <span className="font-mono text-[11px] text-bf-sub truncate max-w-[120px]">{inv.run_id}</span> : null}
          menu={liveKey ? [["Open case", `#/bank/cases/${liveKey}`]] : undefined}>
          <Investigator key={s?.call?.id || "none"} data={data} toast={toast} compact />
        </Gadget>
        <div className="col-span-3 flex flex-col gap-[clamp(8px,0.8vw,16px)] min-h-0">
        <Gadget title="Awaiting your approval" className={`flex-[0_1_auto] ${s?.impact?.freeze_pending || (s?.accounts || []).some((a) => a.status === "blocked") && !s.impact.freeze_approved && !s.impact.freeze_rejected ? "ring-2 ring-bf-amber" : ""}`}
          menu={liveKey ? [["Open case", `#/bank/cases/${liveKey}`]] : undefined} bodyClass="px-4 pb-4">
          <Decision s={s} caseKey={liveKey} detail={detail} toast={toast} data={data} />
        </Gadget>
        <Gadget title="Recent activity" className="flex-1 min-h-[90px]" bodyClass="overflow-y-auto scroll-thin px-4 pb-2" menu={[["Open audit log", "#/bank/audit"]]}>
          <Activity rows={ov?.activity} />
        </Gadget>
        </div>
      </div>
    </div>
  );
}

// ---------- members ----------

const FILTERS = [["all", "All"], ["seniors", "Seniors 75+"], ["watch", "On watch"], ["case", "Affected by a case"]];

function Members({ data, query }) {
  const [res] = useApi("/api/bank/members", data?.ts);
  const [q, setQ] = useState(query.get("q") || "");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState(["id", 1]);
  const [open, setOpen] = useState(null);
  useEffect(() => setQ(query.get("q") || ""), [query.get("q")]);
  const rows = useMemo(() => {
    let r = res?.members || [];
    if (filter === "seniors") r = r.filter((m) => m.age >= 75);
    if (filter === "watch") r = r.filter((m) => m.watch !== "ACTIVE");
    if (filter === "case") r = r.filter((m) => m.cases.length);
    if (q) r = r.filter((m) => `${m.name} ${m.member_id} ${m.accounts.join(" ")}`.toLowerCase().includes(q.toLowerCase()));
    const [k, d] = sort;
    return [...r].sort((a, b) => {
      const x = k === "accounts" ? a.accounts.length : k === "risk" ? a.risk_flags.length : a[k];
      const y = k === "accounts" ? b.accounts.length : k === "risk" ? b.risk_flags.length : b[k];
      return (x > y ? 1 : x < y ? -1 : 0) * d;
    });
  }, [res, q, filter, sort]);
  const col = (k, l, cls) => <Th className={cls} onClick={() => setSort([k, sort[0] === k ? -sort[1] : 1])} active={sort[0] === k} dir={sort[1]}>{l}</Th>;
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Members"]]} title="Members" sub={`${res?.members?.length || 0} CalHacks Federal members · masked account numbers`} />
      <div className="flex items-center gap-2 mb-3">
        <div className="relative w-72">
          <Icon name="search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-bf-sub" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, member ID, account"
            className="w-full h-9 rounded-[3px] border-2 border-bf-line pl-9 pr-3 text-sm outline-none focus:border-bf-blue" />
        </div>
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`h-9 rounded-[3px] px-3 text-sm font-semibold ${filter === k ? "bg-bf-navy text-white" : "bg-bf-line/60 text-bf-ink hover:bg-bf-line"}`}>{l}</button>
        ))}
        <span className="ml-auto text-sm text-bf-sub">{rows.length} shown</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin bg-white border border-bf-line rounded-[4px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white z-10"><tr>
            {col("member_id", "Member ID")}{col("name", "Name")}{col("age", "Age")}{col("member_since", "Member since")}{col("accounts", "Accounts")}
            {col("balance", "Balance", "text-right")}{col("last_activity", "Last activity")}{col("risk", "Risk flags")}{col("watch", "Watch status")}
          </tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} onClick={() => setOpen(m.id)} className={`cursor-pointer hover:bg-bf-bg ${open === m.id ? "bg-[#DEEBFF]" : ""}`}>
                <td className={`${tdc} font-mono text-bf-sub`}>{m.member_id}</td>
                <td className={`${tdc} font-semibold`}>{m.name}{m.cases.map((c) => <a key={c} href={`#/bank/cases/${c}`} onClick={(e) => e.stopPropagation()} className="ml-2 text-bf-blue text-[12px] font-bold hover:underline">{c}</a>)}</td>
                <td className={tdc}>{m.age}</td>
                <td className={`${tdc} text-bf-sub`}>{fmtDay(m.member_since)}</td>
                <td className={`${tdc} font-mono text-[13px]`}>{m.accounts.join(", ")}</td>
                <td className={`${tdc} text-right tabular-nums`}>{money(m.balance)}</td>
                <td className={`${tdc} text-bf-sub`}>{fmtDate(m.last_activity)}</td>
                <td className={tdc}>{m.risk_flags.map((f) => <span key={f} className="mr-1 rounded-[3px] bg-bf-bg ring-1 ring-bf-line px-1.5 text-[12px] text-bf-sub">{f}</span>)}</td>
                <td className={tdc}><Lozenge s={m.watch} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <MemberPanel id={open} ts={data?.ts} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MemberPanel({ id, ts, onClose }) {
  const [m] = useApi(`/api/bank/members/${id}`, ts);
  const ref = useOutside(true, onClose);
  return (
    <div ref={ref} className="fixed right-0 top-[59px] bottom-0 w-[min(520px,42vw)] bg-white shadow-2xl border-l border-bf-line z-40 flex flex-col animate-pop">
      <div className="px-5 py-4 border-b border-bf-line flex items-start gap-3">
        <div className="flex-1">
          <div className="text-sm text-bf-sub font-mono">{m?.member_id}</div>
          <div className="text-xl font-bold text-bf-ink">{m?.name} <span className="text-bf-sub font-normal">· {m?.age}</span></div>
          <div className="text-sm text-bf-sub">Member since {fmtDay(m?.member_since)}</div>
        </div>
        {m && <Lozenge s={m.watch} />}
        <button onClick={onClose} className="text-bf-sub hover:text-bf-ink text-sm font-semibold ml-2">✕</button>
      </div>
      {m && (
        <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-5">
          {m.cases.length > 0 && <div className="rounded-[4px] bg-[#FFEBE6] px-3 py-2 text-sm text-bf-ink">Affected by {m.cases.map((c) => <a key={c} href={`#/bank/cases/${c}`} className="font-bold text-bf-blue hover:underline mr-2">{c}</a>)}</div>}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-bf-sub mb-2">Accounts</h3>
            {m.account_list.map((a) => (
              <div key={a.number} className="flex items-center gap-3 py-2 border-b border-bf-line">
                <span className="font-semibold w-20">{a.kind}</span><span className="font-mono text-bf-sub">{a.number}</span>
                {a.label && <span className="text-[12px] text-bf-red font-semibold">{a.label}</span>}
                <span className="ml-auto tabular-nums font-semibold">{money(a.balance)}</span>
                {a.status !== "active" && <Lozenge s={a.status === "frozen" ? "FROZEN" : "BLOCKED"} />}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-bf-sub mb-2">Transfers</h3>
            {m.transfers.length === 0 && <div className="text-sm text-bf-sub">No outgoing transfers.</div>}
            {m.transfers.map((t) => (
              <div key={t.id} className="py-2 border-b border-bf-line">
                <div className="flex items-center gap-2"><span className="font-semibold tabular-nums">{money(t.amount)}</span><span className="text-bf-sub text-sm truncate">→ {t.to}</span><span className="ml-auto"><Lozenge s={TRANSFER[t.status]} /></span></div>
                <div className="text-[13px] text-bf-sub">“{t.memo}” · {fmtDate(t.created_at)}{t.case && <> · <a href={`#/bank/cases/${t.case}`} className="text-bf-blue font-semibold hover:underline">{t.case}</a></>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- cases ----------

const PRIORITY = { Highest: ["⇈", "text-bf-red"], High: ["↑", "text-[#FF5630]"], Medium: ["=", "text-bf-amber"], Low: ["↓", "text-bf-blue"] };
const Priority = ({ p }) => <span className="whitespace-nowrap"><b className={`${(PRIORITY[p] || PRIORITY.Medium)[1]} mr-1`}>{(PRIORITY[p] || PRIORITY.Medium)[0]}</b>{p}</span>;
const Assignee = ({ a }) => (
  <span className="inline-flex items-center gap-2 whitespace-nowrap">
    <ActorIcon actor={a === "MargaretSGS seat" ? "scamwatch" : "analyst"} size="h-6 w-6 text-[10px]" />{a}
  </span>
);

function Cases({ data }) {
  const [res] = useApi("/api/bank/cases", data?.ts);
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Cases"]]} title="Cases" sub="One case per decoy call. The AI seat opens and works them; analysts decide." />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin bg-white border border-bf-line rounded-[4px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white"><tr><Th>Key</Th><Th>Summary</Th><Th>Priority</Th><Th>Status</Th><Th>Assignee</Th><Th className="text-right">Protected</Th><Th>Created</Th><Th>Time in status</Th></tr></thead>
          <tbody>
            {(res?.cases || []).map((c) => (
              <tr key={c.key} onClick={() => (location.hash = `#/bank/cases/${c.key}`)} className="cursor-pointer hover:bg-bf-bg">
                <td className={`${tdc} font-semibold text-bf-blue whitespace-nowrap`}>{c.key}{c.live && <Lozenge s="LIVE" className="ml-2" />}</td>
                <td className={`${tdc} font-semibold`}>{c.summary}</td>
                <td className={tdc}><Priority p={c.priority} /></td>
                <td className={tdc}><Lozenge s={c.status} /></td>
                <td className={tdc}><Assignee a={c.assignee} /></td>
                <td className={`${tdc} text-right tabular-nums`}>{c.protected ? money(c.protected) : "—"}</td>
                <td className={`${tdc} text-bf-sub whitespace-nowrap`}>{fmtDate(c.created_at)}</td>
                <td className={`${tdc} text-bf-sub`}>{ago(c.status_since)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Markdown({ text }) {
  const inline = (s) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") ? <code key={i} className="font-mono text-[13px] bg-bf-bg px-1 rounded">{p.slice(1, -1)}</code> : p);
  return (
    <div className="space-y-1.5 text-[15px] text-bf-ink leading-relaxed">
      {text.split("\n").map((l, i) => l.startsWith("# ") ? <h3 key={i} className="text-lg font-bold">{inline(l.slice(2))}</h3>
        : l.startsWith("## ") ? <h4 key={i} className="font-bold mt-3">{inline(l.slice(3))}</h4>
        : l.startsWith("- ") ? <div key={i} className="pl-4 relative"><span className="absolute left-0">•</span>{inline(l.slice(2))}</div>
        : l.trim() ? <p key={i}>{inline(l)}</p> : null)}
    </div>
  );
}

const Section = ({ title, children, right }) => (
  <section className="bg-white border border-bf-line rounded-[4px] p-5">
    <div className="flex items-center mb-3"><h2 className="text-[16px] font-bold text-bf-ink flex-1">{title}</h2>{right}</div>
    {children}
  </section>
);

function CaseDetail({ data, id, toast }) {
  const [c] = useApi(`/api/bank/cases/${id}`, data?.ts);
  const [full, setFull] = useState(false);
  if (!c) return <div className="text-bf-sub">Loading {id}… <a href="#/bank/cases" className="ml-2 text-bf-blue font-semibold hover:underline">Back to cases</a></div>;
  const s = data?.session;
  const lines = c.transcript || [];
  const excerpt = full ? lines : lines.filter((l) => l.speaker === "caller" && (l.p_scam > 0.6 || /\d|zero|one|two|three|four|five|six|seven|eight|nine/.test(l.text)));
  const imp = c.impact;
  return (
    <div className="h-full overflow-y-auto scroll-thin pr-1">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Cases", "#/bank/cases"], [c.key]]} title={c.summary}
        sub={c.live ? `Decoy call ${c.call_id} · ${c.call?.status === "active" ? "call in progress" : "call ended"}` : "Archived decoy-line case"} />
      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-8 space-y-4">
          {c.live && (
            <Section title="Why it was flagged">
              {c.accounts.length === 0 && <div className="text-[14px] text-bf-sub">No account number was read out on this call, so nothing was checked or blocked.</div>}
              {c.accounts.map((a) => (
                <div key={a.number} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1.5"><span className="font-mono font-bold">{a.bank} ••{a.number.slice(-4)}</span>
                    <Lozenge s={a.status === "blocked" ? "BLOCKED" : "NO ACTION"} /></div>
                  <FlagSummary detailed checks={a.why} summary={c.summary} blocked={a.status === "blocked"} footnote={c.verdict} />
                </div>
              ))}
            </Section>
          )}
          {c.live && (
            <Section title={<span className="inline-flex items-center gap-2"><ActorIcon actor="creao" size="h-6 w-6 text-[10px]" />MargaretSGS Investigator (CREAO)</span>}
              right={<span className="text-xs text-bf-sub">Agent proposes · analyst approves each block</span>}>
              <Investigator key={s?.call?.id || "none"} data={data} toast={toast} />
            </Section>
          )}
          {c.live && c.accounts.filter((a) => a.discrepancy).map((a) => (
            <Section key={a.number} title={<span>Sources disagree <span className="text-bf-sub font-normal">· {a.bank} ••{a.number.slice(-4)}</span></span>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[4px] bg-[#FFEBE6] p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-[#BF2600] mb-1">What it claims to be: {a.discrepancy.claimed}</div>
                  {a.discrepancy.claims.map((x, i) => <div key={i} className="text-[14px] mt-1"><span className="text-bf-sub">{x.source}:</span> “{x.says}”</div>)}
                </div>
                <div className="rounded-[4px] bg-[#E3FCEF] p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-bf-green mb-1">What our data says</div>
                  {a.discrepancy.facts.map((x, i) => <div key={i} className="text-[14px] mt-1"><span className="text-bf-sub">{x.source}:</span> {x.says}</div>)}
                </div>
              </div>
              <div className="mt-3 text-[15px] font-semibold text-bf-ink">⚖ {a.discrepancy.rule}</div>
            </Section>
          ))}
          {c.live && (imp.holds.length + imp.lookback.length > 0) && (
            <Section title="Holds and recalls" right={<span className="font-bold text-bf-green">{money(imp.protected_total)}</span>}>
              <table className="w-full"><tbody>
                {imp.holds.map((h) => <tr key={`h${h.transfer_id}`}><td className={tdc}><Lozenge s="HELD" /></td><td className={`${tdc} font-semibold`}>{h.customer}, {h.age}</td><td className={tdc}>“{h.memo}”</td><td className={`${tdc} text-right tabular-nums font-semibold`}>{money(h.amount)}</td></tr>)}
                {imp.lookback.map((h) => <tr key={`r${h.transfer_id}`}><td className={tdc}><Lozenge s="RECALL REQUESTED" /></td><td className={`${tdc} font-semibold`}>{h.customer}, {h.age}</td><td className={tdc}>“{h.memo}” · {h.days_ago} days ago</td><td className={`${tdc} text-right tabular-nums font-semibold`}>{money(h.amount)}</td></tr>)}
                {imp.notified.map((n) => <tr key={n}><td className={tdc}><Lozenge s="NEW" /></td><td className={tdc} colSpan={3}>{n} notified of the mule account (simulated)</td></tr>)}
              </tbody></table>
            </Section>
          )}
          {c.live && (
            <Section title="Transcript excerpt" right={<button onClick={() => setFull(!full)} className="text-sm text-bf-blue font-semibold hover:underline">{full ? "Key lines only" : "Full transcript"}</button>}>
              <div className="space-y-1.5">
                {excerpt.length === 0 && <div className="text-bf-sub text-sm">No caller lines yet.</div>}
                {excerpt.map((l, i) => (
                  <div key={i} className="flex gap-3 text-[15px]">
                    <span className={`w-20 shrink-0 font-semibold ${l.speaker === "caller" ? "text-bf-ink" : "text-bf-sub"}`}>{l.speaker === "caller" ? "Caller" : "Margaret"}</span>
                    <span className="flex-1">{l.text}</span>
                    {l.stage && <span className="text-[12px] text-bf-sub whitespace-nowrap">{STAGE_NAMES[l.stage] || l.stage} {Math.round(l.p_scam * 100)}%</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="SAR draft" right={<span className="text-xs text-bf-sub">Drafted by the AI seat · analyst review required</span>}>
            {c.sar?.markdown ? <Markdown text={c.sar.markdown} /> : <div className="text-bf-sub text-sm">{c.sar?.status === "drafting" ? "Drafting…" : "No SAR for this case."}</div>}
          </Section>
        </div>
        <div className="col-span-4 space-y-4 sticky top-0">
          <section className="bg-white border border-bf-line rounded-[4px] p-5">
            <div className="flex items-center gap-2 mb-3"><Lozenge s={c.status} className="text-[13px] px-2 py-0.5" /><span className="text-sm text-bf-sub">for {ago(c.status_since)}</span></div>
            {c.live && <Decision s={s} caseKey={c.key} detail={c} toast={toast} compact data={data} />}
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[14px]">
              <dt className="text-bf-sub">Assignee</dt><dd><Assignee a={c.assignee} /></dd>
              <dt className="text-bf-sub">Reporter</dt><dd><Assignee a="MargaretSGS seat" /></dd>
              <dt className="text-bf-sub">Priority</dt><dd><Priority p={c.priority} /></dd>
              <dt className="text-bf-sub">Protected</dt><dd className="font-semibold text-bf-green">{money(c.protected)}</dd>
              <dt className="text-bf-sub">Created</dt><dd>{fmtDate(c.created_at)}</dd>
              {c.intel?.agency && <><dt className="text-bf-sub">Claimed agency</dt><dd>{c.intel.agency}</dd></>}
              {c.intel?.name && <><dt className="text-bf-sub">Caller name</dt><dd>{c.intel.name}</dd></>}
              {c.intel?.callback && <><dt className="text-bf-sub">Callback</dt><dd className="font-mono">{c.intel.callback}</dd></>}
            </dl>
            {c.blocklist.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-bf-sub mb-1">Blocklist entries</div>
                {c.blocklist.map((b) => <div key={b.number} className="flex items-center gap-2 text-[14px] py-1"><span className="font-mono">{b.bank} ••{b.number.slice(-4)}</span><span className="ml-auto"><Lozenge s={b.status} /></span></div>)}
              </div>
            )}
          </section>
          <section className="bg-white border border-bf-line rounded-[4px] p-5">
            <h2 className="text-[16px] font-bold text-bf-ink mb-3">Decision history</h2>
            <ol className="space-y-3">
              {c.history.map((h, i) => (
                <li key={i} className="flex gap-2.5">
                  <ActorIcon actor={h.actor} />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-bf-ink leading-snug">{h.action}</div>
                    {h.note && <div className="text-[13px] text-bf-sub">{h.note}</div>}
                    <div className="text-[11px] text-bf-sub">{(ACTOR[h.actor] || ACTOR.system)[2]} · {fmtDate(h.ts)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- blocklist, payments, audit ----------

function Blocklist({ data, simulate }) {
  const [res] = useApi("/api/bank/blocklist", data?.ts);
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Blocklist"]]} title="Mule account blocklist"
        sub="Screened on every wire, ACH and Zelle payment. Feed: GET /api/v1/blocklist"
        right={<Btn kind="primary" onClick={simulate}>Simulate: new wire next week</Btn>} />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin bg-white border border-bf-line rounded-[4px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white"><tr><Th>Account</Th><Th>Routing</Th><Th>Bank</Th><Th>Where</Th><Th>Status</Th><Th>Source case</Th><Th className="text-right">Matched payments</Th><Th>Added</Th></tr></thead>
          <tbody>
            {(res?.accounts || []).map((b) => (
              <tr key={b.routing + b.number}>
                <td className={`${tdc} font-mono font-semibold`}>{b.number}</td>
                <td className={`${tdc} font-mono text-bf-sub`}>{b.routing}</td>
                <td className={tdc}>{b.bank}</td>
                <td className={`${tdc} text-bf-sub`}>{b.internal ? "Our member account" : "Other bank (notified)"}</td>
                <td className={tdc}><Lozenge s={b.status} /></td>
                <td className={tdc}>{b.case ? <a href={`#/bank/cases/${b.case}`} className="text-bf-blue font-semibold hover:underline">{b.case}</a> : "—"}</td>
                <td className={`${tdc} text-right tabular-nums`}>{b.hits ? `${b.hits} · ${money(b.hit_amount)}` : "—"}</td>
                <td className={`${tdc} text-bf-sub`}>{fmtDate(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payments({ data, simulate, toast }) {
  const [res, refresh] = useApi("/api/bank/payments", data?.ts);
  const [tab, setTab] = useState("watch");
  const rows = (res?.payments || []).filter((p) => tab === "all" || p.status !== "completed" || p.case);
  const release = (id) => post("/api/bank/release", { transfer_id: id }).then(() => { toast("Hold released and audited."); refresh(); }).catch((e) => toast(e.message, true));
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Payments"]]} title="Payments"
        right={<Btn kind="primary" onClick={simulate}>Simulate: new wire next week</Btn>} />
      <div className="flex gap-1 mb-3">
        {[["watch", "Under watch"], ["all", "All payments"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-9 rounded-[3px] px-3 text-sm font-semibold ${tab === k ? "bg-bf-navy text-white" : "bg-bf-line/60 text-bf-ink hover:bg-bf-line"}`}>{l}</button>
        ))}
        <span className="ml-auto text-sm text-bf-sub self-center">{rows.length} payments</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin bg-white border border-bf-line rounded-[4px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white"><tr><Th>Date</Th><Th>Member</Th><Th className="text-right">Amount</Th><Th>Destination</Th><Th>Memo</Th><Th>Status</Th><Th>Case</Th><Th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.created_at > new Date().toISOString().slice(0, 19) ? "bg-[#DEEBFF]/50" : ""}>
                <td className={`${tdc} text-bf-sub whitespace-nowrap`}>{fmtDate(p.created_at)}</td>
                <td className={`${tdc} font-semibold`}>{p.member} <span className="text-bf-sub font-normal">· {p.age}</span></td>
                <td className={`${tdc} text-right tabular-nums font-semibold`}>{money(p.amount)}</td>
                <td className={`${tdc} text-bf-sub`}>{p.to}</td>
                <td className={`${tdc} text-bf-sub`}>“{p.memo}”</td>
                <td className={tdc}><Lozenge s={TRANSFER[p.status] || p.status} /></td>
                <td className={tdc}>{p.case ? <a href={`#/bank/cases/${p.case}`} className="text-bf-blue font-semibold hover:underline">{p.case}</a> : ""}</td>
                <td className={`${tdc} text-right`}>{p.status === "held" && <Btn kind="subtle" className="py-1" onClick={() => release(p.id)}>Release</Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Audit({ data }) {
  const [res] = useApi("/api/bank/audit", data?.ts);
  return (
    <div className="h-full flex flex-col min-h-0">
      <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Audit log"]]} title="Audit log" sub="Every automated and human decision, with the evidence. Append-only." />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin bg-white border border-bf-line rounded-[4px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white"><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Details</Th></tr></thead>
          <tbody>
            {(res?.rows || []).map((r, i) => (
              <tr key={i}>
                <td className={`${tdc} font-mono text-[13px] text-bf-sub whitespace-nowrap`}>{fmtDate(r.ts)}<span className="ml-1">{fmtTime(r.ts).slice(5)}</span></td>
                <td className={tdc}><span className="inline-flex items-center gap-2 whitespace-nowrap"><ActorIcon actor={r.actor} size="h-6 w-6 text-[10px]" />{(ACTOR[r.actor] || ACTOR.system)[2]}</span></td>
                <td className={`${tdc} font-semibold`}>{describe(r)}</td>
                <td className={`${tdc} font-mono text-[12px] text-bf-sub break-all max-w-[520px]`}>{JSON.stringify(r.details).slice(0, 240)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- model ----------

function LossCurve({ log }) {
  const pts = (log || []).filter((r) => r.loss != null).map((r) => [r.step, r.loss]);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!pts.length) return;
    const t = setInterval(() => setN((k) => (k >= pts.length ? (clearInterval(t), k) : k + 1)), Math.max(16, 5000 / pts.length));
    return () => clearInterval(t);
  }, [log]);
  if (!pts.length) return null;
  const W = 640, H = 200, P = 28;
  const maxX = pts[pts.length - 1][0], maxY = Math.max(...pts.map((p) => p[1]));
  const xy = (p) => [P + (p[0] / maxX) * (W - 2 * P), H - P - (p[1] / maxY) * (H - 2 * P)];
  const d = pts.slice(0, n).map((p, i) => `${i ? "L" : "M"}${xy(p).join(",")}`).join(" ");
  const last = pts[Math.max(0, n - 1)];
  return (
    <Gadget title="How it learned (fine-tune on a Vultr GPU)" className="col-span-12" right={<span className="font-mono text-sm text-bf-sub">step {last[0]} · loss {last[1].toFixed(3)}</span>}>
      <p className="text-sm text-bf-sub -mt-1 mb-1 max-w-4xl">
        <b className="text-bf-ink">Loss</b> is how wrong the model's guesses were while it trained: lower is better. It falls fast as the model
        picks up the obvious patterns (“Federal Reserve”, “don't tell your bank”), then flattens. Flat means more training of the same kind
        wouldn't buy much; the real test is the unseen calls above.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#DFE1E6" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#DFE1E6" />
        <path d={d} fill="none" stroke="#012169" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <text x={W - P} y={H - 8} fontSize="11" fill="#5E6C84" textAnchor="end">{maxX} steps</text>
      </svg>
    </Gadget>
  );
}

function Model({ data }) {
  const [m, setM] = useState(null);
  useEffect(() => { fetch("/api/model").then((r) => r.json()).then(setM).catch(() => setM({})); }, []);
  const head = <PageHead crumbs={[["Fraud Ops", "#/bank/overview"], ["Reports"], ["Model"]]} title="MargaretSGS model" sub="The classifier behind the AI seat's gate. Measured on calls it never trained on." />;
  if (!m) return head;
  if (!m.model) return <div>{head}<Gadget title="No trained model yet">The live call is using the keyword fallback. Run training/train_baseline.py.</Gadget></div>;
  const heldout = m.int8_heldout || m.heldout;
  const ho = heldout?.call_level || m.call_level || {};
  const f1 = Object.entries(m.per_stage_f1 || {}).sort((a, b) => b[1] - a[1]);
  const big = "text-[clamp(28px,2.2vw,44px)] font-bold leading-none tracking-tight";
  const cpu = m.latency_ms_per_window_laptop_cpu;
  const ms = cpu ?? m.latency_ms_per_window;
  const name = (k) => STAGE_NAMES[k] || k;
  const lab = m.confusion?.labels || [];
  const mixups = (m.confusion?.matrix || []).flatMap((row, i) => row.map((v, j) => ({ v, i, j }))).filter((c) => c.i !== c.j && c.v > 0)
    .sort((a, b) => b.v - a.v).slice(0, 3);
  const Explain = ({ children }) => <div className="text-[13.5px] text-bf-sub mt-2 leading-snug">{children}</div>;
  const Num = ({ children, tone = "text-bf-ink" }) => <div className={`${big} ${tone}`}>{children}</div>;
  const grade = (raw) => { const v = Math.round(raw * 100) / 100; return v >= 0.9 ? ["Strong", "bg-[#E3FCEF] text-bf-green"] : v >= 0.8 ? ["Good", "bg-[#DEEBFF] text-bf-blue"] : ["Weaker", "bg-[#FFFAE6] text-[#974F0C]"]; };
  return (
    <div className="h-full overflow-y-auto scroll-thin pr-1">
      {head}
      <section className="mb-4 rounded-[4px] border border-bf-line border-l-[4px] border-l-bf-navy bg-white px-5 py-3 text-[14.5px] text-bf-ink leading-relaxed">
        <b>How to read this page.</b> MargaretSGS reads every caller line and labels which step of a scam it is: authority, fear, secrecy,
        the “safe account” ask, reading out an account, or an ordinary call. One label never blocks anyone. The gate only blocks when the
        steps add up, the scam score passes {threshold(data).toFixed(2)}, the routing number is valid and the account isn't allowlisted.
        Every number below is measured on <b>{heldout?.n_calls || 200} calls the model never saw</b>, written by a different AI with a different prompt, unless it says “test set”.
      </section>
      <div className="grid grid-cols-12 gap-4">
        <Gadget title="Innocent accounts blocked" className="col-span-3">
          <Num tone={ho.false_positive_blocks === 0 ? "text-bf-green" : "text-bf-red"}>{ho.false_positive_blocks ?? "—"}</Num>
          <Explain>Across <b className="text-bf-ink">{ho.non_scam_calls}</b> legitimate calls, including real bank fraud alerts and title companies reading out account numbers. The number that matters most: a false block freezes a real person's money.</Explain>
        </Gadget>
        <Gadget title="Scams stopped" className="col-span-3">
          <Num>{ho.recall != null ? `${Math.round(ho.recall * 100)}%` : "—"}</Num>
          <Explain><b className="text-bf-ink">{ho.caught} of {ho.scam_calls_with_account}</b> unseen scam calls where the scammer read out an account ended with that account blocked. A miss is safe: nothing is blocked and Margaret keeps the scammer talking.</Explain>
        </Gadget>
        <Gadget title="Lines labelled correctly" className="col-span-3">
          <Num>{Math.round((heldout?.accuracy ?? m.accuracy ?? 0) * 100)}%</Num>
          <Explain>Of caller lines on unseen calls, the model named the right scam step. On its own test set it's {Math.round((m.accuracy || 0) * 100)}%. The gap is the price of a different writing style, which is why we test this way.</Explain>
        </Gadget>
        <Gadget title="Time to read one line" className="col-span-3">
          <Num>{ms != null ? `${Math.round(ms)} ms` : "—"}</Num>
          <Explain>{cpu ? "On a laptop CPU" : `On an ${m.gpu || "GPU"}`}, for {m.model?.replace("finetuned:", "") || "the model"}. A person takes about 200 ms to start replying, so the label is ready before Margaret speaks.</Explain>
        </Gadget>
        <LossCurve log={m.train_log} />
        <Gadget title="How well it spots each step" className="col-span-5">
          <p className="text-sm text-bf-sub -mt-1 mb-3">
            The <b className="text-bf-ink">F1 score</b> (0 to 1) asks two things at once: when it says “Fear”, is it right, and does it find every
            fear line? 1.00 is perfect. Test set, {m.n_test_windows?.toLocaleString() || "—"} lines.
          </p>
          <div className="space-y-2">
            {f1.map(([k, v]) => {
              const [g, gc] = grade(v);
              return (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-40 min-w-0">
                    <div className="text-sm font-semibold text-bf-ink leading-tight">{name(k)}</div>
                    <div className="text-[11.5px] text-bf-sub truncate">{STAGE_WORDS[k]}</div>
                  </div>
                  <div className="flex-1 h-2.5 bg-bf-bg rounded-full overflow-hidden"><div className="h-full bg-bf-navy rounded-full" style={{ width: `${v * 100}%` }} /></div>
                  <div className="w-10 text-right font-mono text-sm">{v.toFixed(2)}</div>
                  <span className={`w-14 text-center rounded-[3px] text-[10.5px] font-bold uppercase py-[1px] ${gc}`}>{g}</span>
                </div>
              );
            })}
          </div>
        </Gadget>
        {m.confusion && (
          <Gadget title="Where it gets confused" className="col-span-7" bodyClass="p-4 overflow-x-auto">
            <p className="text-sm text-bf-sub -mt-1 mb-3">
              Each row is what a line <b className="text-bf-ink">really</b> was; each column is what the model <b className="text-bf-ink">guessed</b>.
              Green on the diagonal is right. Red is a mix-up, and most mix-ups are between neighbouring steps, which the gate tolerates because it needs several steps to agree.
            </p>
            <table className="text-xs font-mono">
              <thead>
                <tr><th className="text-left font-sans text-[11px] text-bf-sub font-semibold pb-1">really ↓ · guessed →</th>
                  {lab.map((l) => <th key={l} className="px-1 pb-2 text-bf-sub font-medium align-bottom"><div className="w-12 leading-tight font-sans text-[11px]">{name(l)}</div></th>)}</tr>
              </thead>
              <tbody>
                {m.confusion.matrix.map((row, i) => {
                  const max = Math.max(...row, 1);
                  return (
                    <tr key={i}>
                      <td className="pr-2 text-bf-ink font-sans text-right text-[12px] whitespace-nowrap">{name(lab[i])}</td>
                      {row.map((v, j) => (
                        <td key={j} title={`Really ${name(lab[i])}, guessed ${name(lab[j])}: ${v}`} className="text-center w-12 h-8" style={{
                          background: v ? (i === j ? `rgba(0,135,90,${0.15 + 0.7 * v / max})` : `rgba(227,24,55,${0.15 + 0.6 * v / max})`) : "#F4F5F7",
                          color: v && v / max > 0.5 ? "white" : "#172B4D" }}>{v || ""}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {mixups.length > 0 && (
              <div className="mt-3 text-[13px] text-bf-ink">
                <b>Most common mix-ups:</b>{" "}
                {mixups.map((c, k) => <span key={k}>{k > 0 && " · "}{name(lab[c.i])} read as {name(lab[c.j])} <span className="text-bf-sub">({c.v} lines)</span></span>)}
              </div>
            )}
          </Gadget>
        )}
      </div>
    </div>
  );
}

// ---------- app ----------

export default function Bank({ route, data, connected }) {
  const [path, qs] = route.slice(2).split("?");
  const parts = path.split("/");
  const page = parts[1] || "overview";
  const query = useMemo(() => new URLSearchParams(qs || ""), [qs]);
  const [msg, setMsg] = useState(null);
  const toast = (text, error) => setMsg({ text, error });
  useEffect(() => { markSeen(data); }, [data]);
  useEffect(() => { if (!parts[1]) location.replace("#/bank/overview"); }, [route]);
  const simulate = () => post("/api/bank/simulate_wire")
    .then((r) => toast(`Next week: ${r.details.customer} (${r.details.age}) tried to wire ${money(r.details.amount)}. Held automatically: ${r.details.reason}.`))
    .catch((e) => toast(e.message, true));
  const s = data?.session;
  const awaiting = (s?.accounts || []).some((a) => a.status === "blocked") && !s.impact.freeze_approved && !s.impact.freeze_rejected;
  const badge = { cases: awaiting ? 1 : 0, payments: (data?.ledger?.watch || []).filter((t) => t.status === "held").length };
  const props = { data, toast, simulate, query };
  const Page = { overview: Overview, members: Members, cases: parts[2] ? null : Cases, blocklist: Blocklist, payments: Payments, audit: Audit, model: Model }[page];

  return (
    <div className="h-full flex flex-col bg-white text-bf-ink">
      <TopBar page={page} data={data} connected={connected} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar page={page} badge={badge} />
        <main className="flex-1 min-w-0 min-h-0 bg-white px-[clamp(12px,1.4vw,28px)] py-[clamp(10px,1vw,20px)]">
          {page === "cases" && parts[2] ? <CaseDetail data={data} id={decodeURIComponent(parts[2])} toast={toast} /> : Page ? <Page {...props} /> : <Overview {...props} />}
        </main>
      </div>
      <Toast msg={msg} onDone={() => setMsg(null)} />
    </div>
  );
}
