import React, { useEffect, useRef, useState } from "react";

// Shared core for the two apps (Margaret Live at #/live, CalHacks Federal Fraud Ops at #/bank).
// Both render from the same /ws/dashboard snapshot: session, ledger, phone, model, flash.

export const STEPS = [
  { key: "authority", label: "Authority", long: "Claims authority" },
  { key: "fear_urgency", label: "Fear", long: "Fear & urgency" },
  { key: "secrecy", label: "Secrecy", long: "Demands secrecy" },
  { key: "safe_account_request", label: "Safe account", long: "Asks for a “safe account”" },
  { key: "account_details", label: "Account given", long: "Reads out an account" },
];
export const STAGE_NAMES = {
  intro: "Intro", authority: "Authority", fear_urgency: "Fear", secrecy: "Secrecy",
  remote_access: "Remote access", safe_account_request: "Safe-account ask", account_details: "Account details",
  benign_chat: "Benign", legit_business: "Legit business", spam_sales: "Sales",
};
export const STAGE_WORDS = {
  intro: "Introducing themselves", authority: "Claiming to be an official", fear_urgency: "Creating fear and urgency",
  secrecy: "Demanding secrecy", remote_access: "Asking for remote access", safe_account_request: "Asking for a safe account",
  account_details: "Reading out an account", benign_chat: "Small talk", legit_business: "Ordinary business call",
  spam_sales: "Sales pitch",
};
export const GATE_LABELS = {
  pressure_stages: "Pressure tactics heard",
  asked_for_safe_account_first: "“Safe account” asked first",
  scam_score: "Scam score over the block line",
  routing_checksum: "Routing checksum valid",
  not_allowlisted: "Not on allowlist",
};
// The block line comes from server config via the snapshot (`gate.min_score`); this is only the fallback.
export const THRESHOLD = 0.9;
export const threshold = (data) => data?.gate?.min_score ?? THRESHOLD;
export const money = (n) => "$" + Math.round(n || 0).toLocaleString();
export const initials = (name = "") => name.replace(/\(.*\)/, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
export const post = (p, body) => fetch(p, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || r.statusText); return j; });

// ---------- data ----------

export function useLiveState() {
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

export function useClock(call) {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 250); return () => clearInterval(t); }, []);
  if (!call) return "0:00";
  const s = Math.max(0, Math.floor((call.ended_at || now) - call.started_at));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** GET a JSON endpoint and refetch (debounced) whenever the live snapshot changes. */
export function useApi(url, ts) {
  const [d, setD] = useState({ url: null, body: null });
  const [n, setN] = useState(0);
  const have = d.url === url;
  const pending = useRef(null);
  const latest = useRef(url);
  latest.current = url;
  useEffect(() => {
    if (pending.current && have) return; // throttle: one fetch in flight per 300 ms picks up the newest state
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      const u = latest.current;
      fetch(u).then((r) => (r.ok ? r.json() : null)).then((body) => setD({ url: u, body })).catch(() => {});
    }, have ? 300 : 0);
  }, [url, ts, n]);
  useEffect(() => () => clearTimeout(pending.current), []);
  return [have ? d.body : null, () => setN((k) => k + 1)];
}

// ---------- blocks seen by the bank app (red dot on the switcher) ----------

export function blockKey(data) {
  const s = data?.session;
  const n = (s?.accounts || []).filter((a) => a.status === "blocked").length;
  return n ? `${s.call.id}:${n}` : null;
}
export const unseenBlock = (data) => { const k = blockKey(data); return !!k && localStorage.getItem("bf_seen") !== k; };
export const markSeen = (data) => { const k = blockKey(data); k && localStorage.setItem("bf_seen", k); };

// ---------- pieces used by both apps ----------

export function Highlight({ text, tone = "amber" }) {
  const parts = text.split(/(\b(?:\d[\d ]{2,}\d|\d|zero|one|two|three|four|five|six|seven|eight|nine)\b)/gi);
  const cls = tone === "light" ? "bg-white/15 text-white" : "bg-wm-100 text-wm-ink";
  return parts.map((p, i) =>
    i % 2 ? <mark key={i} className={`${cls} font-fmono font-medium rounded px-0.5`}>{p}</mark> : <span key={i}>{p}</span>
  );
}

export function AppSwitcher({ current, dot }) {
  // Margaret Live uses the neutral paper style; the bank console keeps its navy.
  const flow = current === "live";
  const item = (href, label, active, showDot) => (
    <a href={href} className={`relative px-3 py-1.5 rounded-full text-[13px] font-medium transition whitespace-nowrap ${
      active ? (flow ? "bg-fl-ink text-white shadow-primary" : "bg-bf-navy text-white") : (flow ? "text-fl-body hover:text-fl-ink" : "text-bf-sub hover:text-bf-ink")}`}>
      {label}
      {showDot && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-bf-red ring-2 ring-white animate-pulseRing" />}
    </a>
  );
  return (
    <div className={`flex items-center gap-0.5 rounded-full p-1 ${flow ? "bg-white shadow-raised" : "bg-white/80 ring-1 ring-black/5"}`} title="Switch app">
      {item("#/live", "Margaret Live", current === "live")}
      <span className={`text-xs ${flow ? "text-fl-tick" : "text-bf-sub"}`} aria-hidden="true">⇄</span>
      {item("#/bank/overview", "CalHacks Federal", current === "bank", dot && current !== "bank")}
    </div>
  );
}

export function BrainPicker({ className = "" }) {
  const [s, setS] = useState(null);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setS).catch(() => {}); }, []);
  if (!s?.available) return null;
  const pick = (brain) => post("/api/settings", { brain }).then((n) => setS({ ...s, ...n }));
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold ${className}`} title="Used from the next call; the others take over if it fails">
      Margaret's brain
      <select value={s.brain} onChange={(e) => pick(e.target.value)} className="text-sm font-medium rounded-lg px-2 py-1.5 border border-black/10 bg-white">
        {Object.entries(s.available).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

export function useOutside(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const on = (e) => ref.current && !ref.current.contains(e.target) && close();
    const key = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", on);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", on); document.removeEventListener("keydown", key); };
  }, [open]);
  return ref;
}

export function Modal({ children, onClose, wide, className = "" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-bf-ink/50 flex items-center justify-center z-50" onMouseDown={onClose}>
      <div className={`relative bg-white rounded-lg shadow-2xl p-7 w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[85vh] overflow-y-auto scroll-thin ${className}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-5 text-bf-sub hover:text-bf-ink text-sm font-semibold">Close ✕</button>
        {children}
      </div>
    </div>
  );
}
