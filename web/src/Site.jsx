import React, { useEffect, useRef, useState } from "react";
import { SCRIPTS } from "./scripts.js";

// The vendor side: ScammersGetScammed sells a decoy line + MargaretSGS to banks.
// CalHacks Federal Credit Union (the Fraud Ops console at #/bank, the decoy call at #/live) is the fictional bank customer.
// Visual language: white paper + warm orange accents (Giga-inspired, light), Instrument Sans 500 headlines,
// Geist Mono micro-labels with an orange square bullet, one black pill per screen. No grid backgrounds.

const SOURCES = {
  ic3: "https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf",
  psa: "https://www.ic3.gov/PSA/2023/PSA230929",
  ftc: "https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf",
  ftcImp: "https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-impersonation-rule-goes-effect-today",
};

const NAV_H = 66;

function useJson(url) {
  const [d, setD] = useState(null);
  useEffect(() => { fetch(url).then((r) => r.json()).then(setD).catch(() => setD({})); }, [url]);
  return d;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const scroller = (el) => el?.closest(".overflow-y-auto") || document.scrollingElement;

const Micro = ({ children, dot, className = "" }) => (
  <div className={`fl-micro flex items-center gap-2 ${className}`}>
    {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}{children}
  </div>
);

// ■ THE PROBLEM
const Label = ({ children, className = "" }) => (
  <div className={`flex items-center gap-2.5 font-fmono text-[11px] uppercase tracking-[0.14em] text-wm-600 ${className}`}>
    <span className="h-[6px] w-[6px] bg-wm-500" />{children}
  </div>
);

const STYLE = `
@keyframes sgs-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes sgs-rise { 0% { opacity: 0; transform: translateY(8px) } 100% { opacity: 1; transform: none } }
.sgs-cursor { animation: sgs-blink 1s steps(1) infinite; }
.sgs-rise { animation: sgs-rise .45s ease-out both; }
.sgs-noscroll::-webkit-scrollbar { display: none; }
.sgs-noscroll { scrollbar-width: none; }
@media (prefers-reduced-motion: reduce) { .sgs-cursor, .sgs-rise { animation: none; } }
`;

export function SiteNav({ route }) {
  const links = [["#/", "Product"], ["#/how", "Architecture"], ["#/api", "API"], ["#/scripts", "Judge scripts"]];
  return (
    <nav className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-fl-soft print:hidden">
      <style>{STYLE}</style>
      <div className="max-w-6xl mx-auto px-6 h-[66px] grid grid-cols-[1fr_auto_1fr] items-center">
        <a href="#/" className="flex items-center gap-2 text-[17px] font-medium tracking-title text-fl-ink">
          <span className="h-[7px] w-[7px] bg-wm-500" />ScammersGetScammed
        </a>
        <div className="flex items-center gap-8">
          {links.map(([href, label]) => (
            <a key={href} href={href} className={`text-[14px] ${route === href ? "text-fl-ink" : "text-fl-body hover:text-fl-ink"}`}>{label}</a>
          ))}
        </div>
        <div className="flex items-center justify-end gap-5">
          <a href="#/bank/overview" className="text-[14px] text-fl-body hover:text-fl-ink">CalHacks Federal</a>
          <a href="#/live" className="fl-btn px-4 py-2 text-[14px]">Margaret Live</a>
        </div>
      </div>
    </nav>
  );
}

const Section = ({ label, title, sub, children, className = "", wide }) => (
  <section className={`${wide ? "max-w-[1560px]" : "max-w-6xl"} mx-auto px-6 py-20 ${className}`}>
    {label && <Label>{label}</Label>}
    {title && <h2 className="text-[40px] font-medium tracking-display leading-[1.05] text-fl-ink mt-4 max-w-3xl">{title}</h2>}
    {sub && <p className="text-[18px] leading-[1.55] text-fl-body mt-4 max-w-2xl">{sub}</p>}
    <div className={title || label ? "mt-10" : ""}>{children}</div>
  </section>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-[16px] border border-fl-line ${className}`}>{children}</div>
);

// ---------- hero ----------

function TypeIn({ text }) {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (n >= text.length) return;
    const id = setTimeout(() => setN((x) => x + 1), n === 0 ? 250 : 65);
    return () => clearTimeout(id);
  }, [n, text]);
  const done = n >= text.length;
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0 whitespace-nowrap" aria-label={text}>
        {text.slice(0, n)}
        <span className={`inline-block w-[0.5em] h-[0.82em] -mb-[0.06em] ml-[0.06em] bg-wm-500 ${done ? "sgs-cursor" : ""}`} aria-hidden="true" />
      </span>
    </span>
  );
}

function Sparkline() {
  // Scam likelihood across the call, crossing the 0.90 block line when the account is read out.
  const pts = [0.04, 0.05, 0.22, 0.41, 0.55, 0.63, 0.71, 0.84, 0.9, 0.93, 0.97, 0.99, 0.99];
  const W = 420, H = 110;
  const xy = (v, i) => [(i / (pts.length - 1)) * W, H - v * (H - 8) - 4];
  const line = pts.map((v, i) => `${i ? "L" : "M"}${xy(v, i).join(",")}`).join(" ");
  const ty = H - 0.9 * (H - 8) - 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[110px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sgs-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EE7A2A" stopOpacity="0.32" /><stop offset="100%" stopColor="#EE7A2A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#sgs-fill)" />
      <path d={line} fill="none" stroke="#EE7A2A" strokeWidth="2" strokeLinejoin="round" />
      <line x1="0" x2={W} y1={ty} y2={ty} stroke="#E0492F" strokeDasharray="3 3" />
      <line x1={W * 0.77} x2={W * 0.77} y1="0" y2={H} stroke="#1A1A1A" strokeOpacity="0.3" />
    </svg>
  );
}

function HeroMock() {
  return (
    <div className="relative">
      <div className="bg-white rounded-[16px] border border-fl-line shadow-[0_30px_80px_-30px_rgba(238,122,42,0.35)] overflow-hidden">
        <div className="flex items-center justify-between px-5 h-12 border-b border-fl-soft">
          <div className="flex items-center gap-2 text-[14px] font-medium"><span className="h-2 w-2 rounded-full bg-fl-red animate-pulse" />Live call · Margaret, 78</div>
          <span className="font-fmono text-[12px] text-fl-mute">2:41</span>
        </div>
        <div className="grid grid-cols-[1fr_150px]">
          <div className="p-5 border-r border-fl-soft">
            <Micro dot="bg-wm-500">safe_account_request</Micro>
            <div className="text-[26px] font-medium tracking-title leading-tight mt-1.5">Asking for a safe account</div>
            <div className="text-[13px] text-fl-mute">for 0m 48s</div>
            <div className="mt-4 border-y border-fl-soft py-2 flex items-center gap-5 font-fmono text-[11px] text-fl-body whitespace-nowrap">
              <span className="text-fl-mute">what it heard</span><span>authority <span className="text-wm-600">✓</span></span><span>fear <span className="text-wm-600">✓</span></span><span>secrecy <span className="text-wm-600">✓</span></span>
            </div>
            <div className="flex items-center justify-between mt-3 text-[12px] text-fl-mute"><span>Scam likelihood</span><span className="font-fmono text-[11px]">block at 0.90</span></div>
            <Sparkline />
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="rounded-xl bg-fl-sink px-3 py-1.5 w-fit max-w-[90%]">wire your savings to the protected federal reserve account</div>
              <div className="rounded-xl bg-fl-ink text-white px-3 py-1.5 w-fit ml-auto">Could you read the numbers very slowly, dear?</div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div><div className="text-[12px] text-fl-mute">Right now</div><div className="text-[44px] font-medium tracking-title leading-none text-wm-600">99<span className="text-[16px] text-fl-mute ml-0.5">%</span></div><div className="text-[12px] text-fl-mute">scam likelihood</div></div>
            {[["Pressure tactics", "3"], ["Accounts heard", "2"], ["Time wasted", "2:41"], ["Data shared", "0"]].map(([k, v]) => (
              <div key={k} className="border-t border-fl-soft pt-2"><div className="text-[12px] text-fl-mute">{k}</div><div className="text-[15px] font-medium">{v}</div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-10 -right-6 w-[290px] bg-white rounded-[16px] shadow-alert p-4 sgs-rise" style={{ animationDelay: "1.2s" }}>
        <div className="flex items-center justify-between border-b border-fl-soft pb-2"><span className="font-fmono text-[11px] text-wm-600">mule_account.blocked</span><span className="font-fmono text-[11px] text-fl-mute">now</span></div>
        <div className="text-[22px] font-medium tracking-title mt-2">$8,500 wire held.</div>
        <p className="text-[13px] text-fl-body mt-1 leading-snug">The memo says “Federal Reserve”, the routing number says a private credit union. $41,000 in earlier payments sent to recall.</p>
        <div className="flex items-center gap-3 mt-3"><span className="fl-btn px-3.5 py-1.5 text-[12px]">Approve freeze</span><span className="text-[12px] text-fl-body">Review case</span></div>
      </div>
    </div>
  );
}

// ---------- building blocks ----------

const Stat = ({ value, children, href, tag }) => (
  <Card className="p-6 flex flex-col">
    {tag && <div className="font-fmono text-[11px] uppercase tracking-[0.12em] text-fl-mute">{tag}</div>}
    <div className="text-[48px] font-medium tracking-display leading-none text-wm-600 mt-3">{value}</div>
    <div className="text-[14.5px] leading-[1.6] text-fl-body mt-3 flex-1">{children}</div>
    {href && <a href={href} target="_blank" rel="noreferrer" className="font-fmono text-[11px] text-fl-mute underline mt-3 hover:text-wm-600 w-fit">source</a>}
  </Card>
);

function useCarousel({ items }) {
  const ref = useRef(null);
  const by = (dir) => {
    const el = ref.current; if (!el) return;
    const card = el.querySelector("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth || 340) + 16), behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const Btn = ({ dir, children }) => (
    <button onClick={() => by(dir)} aria-label={dir < 0 ? "Previous" : "Next"}
      className="h-10 w-10 rounded-full border border-fl-line bg-white text-fl-ink text-[18px] grid place-items-center hover:border-wm-500 hover:text-wm-600 transition">{children}</button>
  );
  return { ref, arrows: <div className="flex gap-2"><Btn dir={-1}>‹</Btn><Btn dir={1}>›</Btn></div>,
    track: (
      <div ref={ref} className="sgs-noscroll flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 pr-6"
        style={{ paddingLeft: "max(24px, calc((100% - 1152px) / 2 + 24px))", scrollPaddingLeft: "max(24px, calc((100% - 1152px) / 2 + 24px))" }}>
        {items.map((it, i) => (
          <div key={i} data-card className={`group snap-start shrink-0 w-[340px] h-[340px] rounded-[16px] border p-6 flex flex-col transition ${it.accent ? "bg-wm-50 border-wm-200" : "bg-white border-fl-line hover:border-wm-400"}`}>
            <div className="flex items-start justify-between">
              <div className="font-fmono text-[11px] uppercase tracking-[0.12em] text-fl-mute">{it.n}</div>
              <span className="text-wm-600 text-[18px] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition">→</span>
            </div>
            <div className="text-[24px] font-medium tracking-title leading-[1.1] mt-3 text-fl-ink">{it.t}</div>
            <div className="flex-1" />
            <p className="text-[14.5px] leading-[1.6] text-fl-body">{it.d}</p>
          </div>
        ))}
      </div>
    ) };
}

// Sticky scroll block: left column (label, title, steps) pins while scroll advances the active step;
// right panel swaps the mock for that step.
function StickySteps({ label, title, sub, steps, vhPer = 70 }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const sec = ref.current; if (!sec) return;
    const sc = scroller(sec);
    const onScroll = () => {
      const top = sec.getBoundingClientRect().top - (sc.getBoundingClientRect?.().top || 0) - NAV_H;
      const range = sec.offsetHeight - (sc.clientHeight - NAV_H);
      const p = Math.min(0.9999, Math.max(0, -top / Math.max(1, range)));
      setActive(Math.floor(p * steps.length));
    };
    onScroll();
    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { sc.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [steps.length]);
  const go = (i) => {
    const sec = ref.current; const sc = scroller(sec);
    const top = sec.getBoundingClientRect().top - (sc.getBoundingClientRect?.().top || 0) - NAV_H;
    const range = sec.offsetHeight - (sc.clientHeight - NAV_H);
    sc.scrollTo({ top: sc.scrollTop + top + ((i + 0.5) / steps.length) * range, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  const s = steps[active];
  return (
    <section ref={ref} className="relative" style={{ height: `${steps.length * vhPer + 30}vh` }}>
      <div className="sticky top-[66px] h-[calc(100vh-66px)] flex items-center">
        <div className="max-w-6xl w-full mx-auto px-6 grid grid-cols-12 gap-10 items-center">
          <div className="col-span-5">
            <Label>{label}</Label>
            <h2 className="text-[40px] font-medium tracking-display leading-[1.05] text-fl-ink mt-4">{title}</h2>
            {sub && <p className="text-[16px] leading-[1.55] text-fl-body mt-4">{sub}</p>}
            <div className="mt-8">
              {steps.map((x, i) => (
                <button key={x.t} onClick={() => go(i)} className="block w-full text-left group">
                  <div className="h-px bg-fl-line relative"><div className={`absolute left-0 top-0 h-[2px] -mt-px bg-wm-500 transition-all duration-500 ${i === active ? "w-full" : "w-0"}`} /></div>
                  <div className="py-3">
                    <div className="flex items-center gap-3">
                      <span className={`font-fmono text-[11px] ${i === active ? "text-wm-600" : "text-fl-tick"}`}>0{i + 1}</span>
                      <span className={`text-[17px] tracking-title transition ${i === active ? "text-fl-ink font-medium" : "text-fl-mute group-hover:text-fl-ink"}`}>{x.t}</span>
                    </div>
                    <div className={`grid transition-all duration-500 ${i === active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <p className="overflow-hidden text-[14.5px] leading-[1.6] text-fl-body pl-7 pt-1.5">{x.d}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-7">
            <div className="relative rounded-[24px] border border-wm-100 overflow-hidden h-[min(560px,calc(100vh-180px))] grid place-items-center"
              style={{ background: "radial-gradient(120% 80% at 50% 110%, rgba(238,122,42,0.28), rgba(255,235,218,0.5) 45%, #FFFBF7 75%)" }}>
              <div className="absolute top-5 left-6 font-fmono text-[11px] uppercase tracking-[0.12em] text-wm-700/70">0{active + 1} / 0{steps.length} · {s.tag}</div>
              <div key={active} className="sgs-rise w-[min(440px,85%)]">{s.mock}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- step mocks ----------

const MockCard = ({ children, className = "" }) => <div className={`bg-white rounded-[16px] shadow-alert p-5 ${className}`}>{children}</div>;
const Row = ({ k, v, tone }) => (
  <div className="flex items-center justify-between py-2 border-t border-fl-soft text-[14px]">
    <span className="text-fl-body">{k}</span><span className={`font-fmono text-[12px] ${tone || "text-fl-ink"}`}>{v}</span>
  </div>
);

const DO_STEPS = [
  { t: "Scammer calls Margaret", tag: "incoming", d: "On numbers the bank seeds into scam lead lists, or transferred in by a branch or call-center agent.",
    mock: (
      <MockCard>
        <div className="flex items-center justify-between"><Micro dot="bg-wm-500 animate-pulse">incoming call</Micro><span className="font-fmono text-[11px] text-fl-mute">decoy line 03</span></div>
        <div className="text-[30px] font-medium tracking-title mt-3">+1 (202) 555-0147</div>
        <div className="text-[13px] text-fl-mute">“Federal Reserve Security Desk”</div>
        <div className="mt-4"><Row k="Source" v="honeypot number" /><Row k="Seeded in" v="lead list · mar 2025" /><Row k="Answered by" v="Margaret, 78" tone="text-wm-600" /></div>
        <div className="flex gap-2 mt-4"><span className="fl-btn px-4 py-1.5 text-[13px]">Answer</span><span className="rounded-full border border-fl-line px-4 py-1.5 text-[13px]">Transfer</span></div>
      </MockCard>
    ) },
  { t: "Margaret plays along", tag: "transcript", d: "Confused, slow, cooperative. Stalls, mishears, asks them to repeat the account “very slowly.”",
    mock: (
      <MockCard className="space-y-2.5 text-[14px]">
        <Micro>transcript · 2:12</Micro>
        <div className="rounded-xl bg-fl-sink px-3 py-2 w-fit max-w-[85%]">Ma'am, your accounts are compromised. Don't tell the branch, an employee is involved.</div>
        <div className="rounded-xl bg-fl-ink text-white px-3 py-2 w-fit max-w-[85%] ml-auto">Oh my. Hold on dear, let me find my reading glasses…</div>
        <div className="rounded-xl bg-fl-sink px-3 py-2 w-fit max-w-[85%]">Routing five seven two, one zero nine…</div>
        <div className="rounded-xl bg-fl-ink text-white px-3 py-2 w-fit max-w-[85%] ml-auto">Could you read the numbers very slowly, dear?</div>
      </MockCard>
    ) },
  { t: "MargaretSGS listens", tag: "classifier", d: "Our fine-tuned model labels every caller line (authority, fear, secrecy, safe-account ask) in ~80 ms.",
    mock: (
      <MockCard>
        <div className="flex items-center justify-between"><Micro dot="bg-wm-500">margaretsgs · modernbert int8</Micro><span className="font-fmono text-[11px] text-fl-mute">~80 ms</span></div>
        <div className="text-[13px] text-fl-body mt-3 italic">“wire your savings to the protected federal reserve account”</div>
        <div className="flex items-end justify-between mt-4">
          <div><div className="font-fmono text-[11px] text-fl-mute">stage</div><div className="text-[20px] font-medium tracking-title">safe_account_request</div></div>
          <div className="text-right"><div className="font-fmono text-[11px] text-fl-mute">scam score</div><div className="text-[40px] font-medium tracking-title leading-none text-wm-600">0.97</div></div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-4">{["authority", "fear", "secrecy", "safe_account"].map((x) => <span key={x} className="rounded-full bg-wm-50 border border-wm-200 px-2.5 py-0.5 font-fmono text-[11px] text-wm-700">{x}</span>)}</div>
        <div className="mt-4 rounded-xl bg-fl-sink px-3 py-2 text-[13px]"><span className="font-fmono text-[11px] text-fl-mute">coach → </span>Say you're ready and have a pen.</div>
      </MockCard>
    ) },
  { t: "The gate decides", tag: "gate", d: "Blocks only when the model, fixed rules and checksums all agree. The voice AI cannot block anyone.",
    mock: (
      <MockCard>
        <div className="flex items-center justify-between"><Micro dot="bg-wm-500">gate · no llm involved</Micro><span className="rounded-full bg-fl-red-pale text-fl-red-ink px-2.5 py-0.5 font-fmono text-[11px]">block</span></div>
        <div className="mt-3">
          {[["2+ pressure tactics", "3 heard"], ["Safe-account asked first", "2:05"], ["Scam score ≥ 0.90", "0.97"], ["Valid routing (ABA checksum)", "572109086"], ["Not allowlisted", "clear"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 py-2 border-t border-fl-soft text-[14px]">
              <span className="h-5 w-5 rounded-full bg-wm-500 text-white grid place-items-center text-[11px]">✓</span>
              <span className="flex-1">{k}</span><span className="font-fmono text-[12px] text-fl-mute">{v}</span>
            </div>
          ))}
        </div>
      </MockCard>
    ) },
  { t: "The bank acts", tag: "bank controls", d: "Blocklist, hold pending wires, 30-day lookback, notify the receiving bank, draft the SAR. A human approves freezes.",
    mock: (
      <MockCard>
        <div className="flex items-center justify-between border-b border-fl-soft pb-2"><span className="font-fmono text-[11px] text-wm-600">mule_account.blocked</span><span className="font-fmono text-[11px] text-fl-mute">now</span></div>
        <div className="text-[30px] font-medium tracking-title mt-3 leading-tight">$8,500 wire held.</div>
        <div className="text-[30px] font-medium tracking-title leading-tight text-wm-600">$41,000 in recall.</div>
        <div className="mt-3"><Row k="Blocklist" v="provisional" /><Row k="Receiving bank" v="notified" /><Row k="SAR" v="draft ready" /></div>
        <div className="flex items-center gap-3 mt-4"><span className="fl-btn px-4 py-1.5 text-[13px]">Approve freeze</span><span className="text-[13px] text-fl-body">Review case</span></div>
      </MockCard>
    ) },
];

const HIRE_STEPS = [
  { t: "Limited access", tag: "permissions", d: "The AI that talks has no tools. It can't block, move or see money. It can place holds, request recalls and draft SARs. It can't freeze accounts, move money or see full member data.",
    mock: (
      <MockCard>
        <Micro dot="bg-wm-500">role · tier-1 fraud intel</Micro>
        <div className="mt-3">
          {[["Place holds", true], ["Request recalls", true], ["Draft SARs", true], ["Freeze accounts", false], ["Move money", false], ["See full member data", false]].map(([k, ok]) => (
            <div key={k} className="flex items-center gap-3 py-2 border-t border-fl-soft text-[14px]">
              <span className={`h-5 w-5 rounded-full grid place-items-center text-[11px] ${ok ? "bg-wm-500 text-white" : "bg-fl-sink text-fl-mute"}`}>{ok ? "✓" : "✕"}</span>
              <span className={ok ? "" : "text-fl-mute"}>{k}</span>
            </div>
          ))}
        </div>
      </MockCard>
    ) },
  { t: "A clean record of its work", tag: "audit log", d: "Every gate decision, check, hold, recall and approval is written to an audit log with timestamps, the model version and the evidence line.",
    mock: (
      <MockCard>
        <Micro dot="bg-wm-500">audit log</Micro>
        <div className="mt-3 font-fmono text-[12px]">
          {[["14:02:11", "gate.pass", "margaretsgs v3 · 0.97"], ["14:02:11", "blocklist.add", "572109086 / 44108257"], ["14:02:12", "wire.hold", "$8,500"], ["14:02:12", "recall.request", "$41,000"], ["14:02:13", "sar.draft", "case 1042"]].map(([a, b, c]) => (
            <div key={b} className="grid grid-cols-[70px_110px_1fr] gap-2 py-2 border-t border-fl-soft"><span className="text-fl-mute">{a}</span><span className="text-wm-700">{b}</span><span className="text-fl-body truncate">{c}</span></div>
          ))}
        </div>
      </MockCard>
    ) },
  { t: "Knows when to ask", tag: "human in the loop", d: "Holds are reversible, so they're automatic. Freezing an account needs a human analyst, and owners of possible unwitting mule accounts get review, not seizure.",
    mock: (
      <MockCard>
        <Micro dot="bg-wm-500">awaiting analyst</Micro>
        <div className="text-[22px] font-medium tracking-title mt-3">Freeze account ••8257?</div>
        <p className="text-[13.5px] text-fl-body mt-1">Hold is already in place. Freezing needs your approval.</p>
        <div className="flex items-center gap-3 mt-4"><span className="fl-btn px-4 py-1.5 text-[13px]">Approve freeze</span><span className="rounded-full border border-fl-line px-4 py-1.5 text-[13px]">Reject</span></div>
      </MockCard>
    ) },
  { t: "Analysts can say no", tag: "the controller", d: "Rejecting a freeze needs a reason. Blocks stay provisional, holds stay until released, and all of it lands in the audit log.",
    mock: (
      <MockCard>
        <Micro dot="bg-wm-500">reject freeze</Micro>
        <div className="mt-3 rounded-xl border border-fl-line px-3 py-2.5 text-[14px] text-fl-body min-h-[72px]">Reason: account owner may be an unwitting mule, route to review.<span className="sgs-cursor inline-block w-[2px] h-[15px] bg-wm-500 ml-0.5 align-middle" /></div>
        <div className="mt-3"><Row k="Block" v="provisional" /><Row k="Hold" v="until released" /><Row k="Audit log" v="recorded" tone="text-wm-600" /></div>
      </MockCard>
    ) },
  { t: "Says where sources disagree", tag: "evidence", d: "Each gate check is listed with the data behind it, and where sources disagree it says so: the memo claims the Federal Reserve, the routing number says a private bank.",
    mock: (
      <MockCard>
        <Micro dot="bg-wm-500">conflict found</Micro>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl bg-fl-sink p-3"><div className="font-fmono text-[11px] text-fl-mute">wire memo</div><div className="text-[15px] font-medium mt-1">“Federal Reserve”</div></div>
          <div className="rounded-xl bg-wm-50 border border-wm-200 p-3"><div className="font-fmono text-[11px] text-wm-700">routing 572109086</div><div className="text-[15px] font-medium mt-1">Private credit union</div></div>
        </div>
        <p className="text-[13.5px] text-fl-body mt-3">The Federal Reserve does not hold accounts for individuals.</p>
      </MockCard>
    ) },
  { t: "Next week, it still remembers", tag: "over time", d: "When a different member wires the same mule a week later, payment screening holds it and cites the original case.",
    mock: (
      <MockCard>
        <div className="flex items-center justify-between"><Micro dot="bg-wm-500">payment screening</Micro><span className="font-fmono text-[11px] text-fl-mute">+7 days</span></div>
        <div className="text-[24px] font-medium tracking-title mt-3">Wire held: matches blocklist.</div>
        <div className="mt-3"><Row k="Beneficiary" v="572109086 / 44108257" /><Row k="Member" v="different member" /><Row k="Cites" v="original case" tone="text-wm-600" /></div>
      </MockCard>
    ) },
];

// ---------- landing ----------

export function Landing() {
  const m = useJson("/api/model");
  const b = useJson("/api/bench");
  const ho = m?.int8_call_level ? m.int8_heldout?.call_level : m?.heldout?.call_level;
  const phases = useCarousel({ items: [
    { n: "phase 1", t: "Tech support impostor", d: "A pop-up or call says the computer is hacked. The victim installs remote-access software, and opens their bank accounts “to check for charges”, showing the scammer which account holds the most." },
    { n: "phase 2", t: "Bank impostor", d: "A fake fraud department calls, confirms the “hack”, and says an insider at the branch is involved: don't tell anyone, money must move to a new secure account." },
    { n: "phase 3", t: "Government impostor", d: "A fake Federal Reserve or Treasury agent sends the victim to wire everything to a “protected” account, today. That account is a money mule's." },
    { n: "the destination", t: "A money mule's account", accent: true, d: "Grandparent, IRS and tech-support scams end the same way: the scammer must eventually say where the money goes." },
  ] });

  return (
    <div className="bg-white">
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[520px]"
          style={{ background: "radial-gradient(50% 70% at 50% 100%, rgba(238,122,42,0.30), rgba(255,211,174,0.18) 45%, rgba(255,255,255,0) 75%)" }} />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-36 grid grid-cols-12 gap-12 items-center">
          <div className="col-span-6">
            <Label>fraud ops · for banks and credit unions</Label>
            <h1 className="text-[64px] font-medium tracking-hero leading-[1.02] mt-6">
              <span className="font-fmono font-normal tracking-[-0.06em] text-[58px] text-fl-ink"><TypeIn text="Scammers call." /></span><br />
              <span className="text-fl-mute">Margaret answers.</span>
            </h1>
            <p className="text-[18px] leading-[1.55] text-fl-body mt-6 max-w-[520px]">
              Margaret is an AI decoy who answers scam calls for a bank. She keeps the scammer talking until they read out
              their “safe account”. Within seconds the bank blocks it, holds every pending wire to it, and finds the people
              who already paid it.
            </p>
            <div className="flex items-center gap-7 mt-9">
              <a href="#/live" className="fl-btn px-6 py-3.5 text-[16px]">See a live call →</a>
              <a href="#/bank/overview" className="fl-link text-[15px]">Watch the bank block it →</a>
            </div>
          </div>
          <div className="col-span-6"><HeroMock /></div>
        </div>
      </header>

      <Section label="the problem" title="Seniors lose more to fraud than any other age group, and the bank watches it happen.">
        <div className="grid grid-cols-4 gap-4">
          <Stat tag="losses" value="$4.9B" href={SOURCES.ic3}>Lost by Americans 60+ in 2024, up 43% in a year (FBI IC3).</Stat>
          <Stat tag="per victim" value="$33K" href={SOURCES.ic3}>Average reported loss per complaint from someone 60+.</Stat>
          <Stat tag="phantom hacker" value="66%" href={SOURCES.psa}>Of tech-support and phantom-hacker losses came from victims over 60.</Stat>
          <Stat tag="the blind spot" value="$2.09B" href={SOURCES.ftc}>Lost by bank transfer. The victim sends it themselves, so to fraud models it looks legitimate.</Stat>
        </div>
      </Section>

      <section className="py-20 bg-fl-paper border-y border-fl-soft">
        <div className="max-w-6xl mx-auto px-6 flex items-end justify-between gap-8">
          <div>
            <Label>how the scam works</Label>
            <h2 className="text-[40px] font-medium tracking-display leading-[1.05] text-fl-ink mt-4 max-w-3xl">The FBI's “phantom hacker”: three impostors, one destination.</h2>
          </div>
          {phases.arrows}
        </div>
        <div className="mt-10">{phases.track}</div>
        <div className="max-w-6xl mx-auto px-6 mt-6">
          <Card className="p-6 flex items-start gap-5 border-l-[3px] border-l-wm-500">
            <span className="mt-2 h-[6px] w-[6px] bg-wm-500 shrink-0" />
            <p className="text-[18px] leading-[1.55] text-fl-ink"><span className="font-medium">The one thing every version has in common:</span> the scammer must eventually say where the money goes.
              <span className="text-fl-body"> That account number is the weak point, and it's the thing we harvest.</span></p>
          </Card>
          <a href={SOURCES.psa} target="_blank" rel="noreferrer" className="font-fmono text-[11px] text-fl-mute underline mt-3 inline-block hover:text-wm-600">FBI PSA I-092923, “Phantom Hacker” scams</a>
        </div>
      </section>

      <StickySteps label="what we do" title="A decoy line that turns scam calls into blocked mule accounts." steps={DO_STEPS} />

      <section className="bg-fl-paper border-y border-fl-soft">
        <Section label="where it fits in a bank" title="Sits next to fraud ops. Feeds the payment rails the bank already has.">
          <div className="grid grid-cols-3 gap-4">
            {[["01 · honeypot", "Honeypot numbers", "Seed decoy identities and phone numbers into the lead lists scammers buy. Margaret answers when they call."],
              ["02 · warm transfer", "Warm transfer", "When a member or branch reports a scam call in progress, the agent conferences the scammer over to Margaret."],
              ["03 · embedded", "Embedded in the contact center", "Stream any call's transcript to our API from the bank's own recorder. Get stages, a score and coaching back, and blocks by webhook."]].map(([n, t, d]) => (
              <Card key={t} className="p-7"><div className="font-fmono text-[11px] uppercase tracking-[0.12em] text-wm-600">{n}</div><div className="text-[21px] font-medium tracking-title mt-3">{t}</div><p className="text-[14.5px] text-fl-body mt-2 leading-[1.6]">{d}</p></Card>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {["wire / ach / zelle ← blocklist feed", "case management ← webhook + sar", "receiving bank ← mule notice", "consortium ← confirmed mule list"].map((t) => (
              <div key={t} className="rounded-[12px] bg-white border border-fl-line px-4 py-3 font-fmono text-[12px] text-fl-body flex items-center gap-2"><span className="h-[5px] w-[5px] bg-wm-500" />{t}</div>
            ))}
          </div>
        </Section>
      </section>

      <StickySteps label="would you hire it?" title="It fills one seat: a tier-1 fraud-intel analyst who never sleeps." steps={HIRE_STEPS} vhPer={55}
        sub="A payments-controls officer that only takes reversible actions, shows its work, and asks before anything final." />

      <section className="bg-fl-paper border-y border-fl-soft">
        <Section label="proof it works" title="Measured, not promised." sub="Held-out calls written by a different model, never trained on.">
          <div className="grid grid-cols-4 gap-4">
            <Stat tag="recall" value={ho ? `${Math.round(ho.recall * 100)}%` : "—"}>Of scam calls caught that read out an account ({ho?.caught ?? "–"}/{ho?.scam_calls_with_account ?? "–"}).</Stat>
            <Stat tag="false blocks" value={ho ? `${ho.false_positive_blocks}` : "—"}>On {ho?.non_scam_calls ?? "–"} legitimate calls, including real title companies reading out account numbers.</Stat>
            <Stat tag="red team" value={b?.scam ? `${b.scam.leaked_sensitive + b.scam.revealed_decoy_or_ai}` : "0"}>Leaks or character breaks by Margaret under prompt injection, “are you a bot?” and data grabs.</Stat>
            <Stat tag="latency" value={m?.latency_ms_per_window_laptop_cpu ? `${Math.round(m.latency_ms_per_window_laptop_cpu)} ms` : "~80 ms"}>Per caller line for our int8 ONNX model on a laptop CPU.</Stat>
          </div>
          <div className="mt-14">
            <Label>run the numbers</Label>
            <div className="flex items-baseline gap-4 mt-3"><h3 className="text-[28px] font-medium tracking-title">What one bank could stop.</h3><span className="text-[15px] text-fl-mute">Assumptions to play with, not results.</span></div>
            <div className="mt-6"><Impact /></div>
          </div>
          <div className="font-fmono text-[11px] text-fl-mute mt-4">Training and test calls are synthetic (Claude, modeled on FBI/FTC scam patterns). The bank ledger is simulated. The phone call, speech, voice, model and gate are real.</div>
        </Section>
      </section>

      <BuiltWith />

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="relative overflow-hidden rounded-[24px] border border-wm-100 px-12 py-14 flex items-center gap-8"
          style={{ background: "radial-gradient(70% 140% at 85% 120%, rgba(238,122,42,0.26), rgba(255,235,218,0.4) 50%, #FFFFFF 85%)" }}>
          <div className="flex-1">
            <Label>try it</Label>
            <div className="text-[40px] font-medium tracking-display leading-tight mt-3">One four-minute call. <span className="text-wm-600">$49,500 back.</span></div>
            <div className="text-[15px] text-fl-body mt-2">Call Margaret yourself with a judge script, then switch to the bank and approve the freeze.</div>
          </div>
          <a href="#/scripts" className="fl-link text-[15px]">Judge scripts →</a>
          <a href="#/live" className="fl-btn px-6 py-3.5 text-[16px]">See a live call →</a>
        </div>
      </section>
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
      <div className="flex justify-between text-[14px]"><span className="text-fl-body">{label}</span><span className="font-fmono text-wm-700">{v}{unit}</span></div>
      <input type="range" min={min} max={max} value={v} onChange={(e) => set(+e.target.value)} className="w-full accent-[#EE7A2A] mt-1" />
    </label>
  );
  return (
    <Card className="p-8 grid grid-cols-12 gap-10 items-center">
      <div className="col-span-5 space-y-5">
        <Slider label="Scam calls Margaret answers per day" v={calls} set={setCalls} min={1} max={200} unit="" />
        <Slider label="Calls where the scammer reads out an account" v={yieldPct} set={setYieldPct} min={5} max={100} unit="%" />
        <Slider label="Victims per mule account it reaches" v={victims} set={setVictims} min={1} max={10} unit="" />
      </div>
      <div className="col-span-7 grid grid-cols-2 gap-6">
        <div><Micro>mule accounts blocked / year</Micro><div className="text-[56px] font-medium tracking-display leading-none mt-2 text-fl-ink">{Math.round(accounts).toLocaleString()}</div></div>
        <div><Micro>losses stopped or recovered</Micro><div className="text-[56px] font-medium tracking-display leading-none mt-2 text-wm-600">${(saved / 1e6).toFixed(1)}M</div></div>
        <div className="col-span-2 text-[13px] text-fl-mute">Uses the IC3 2024 average loss of $33,200 per victim aged 60+.</div>
      </div>
    </Card>
  );
}

// ---------- infrastructure: where it runs ----------

const ZONE = {
  ours: { box: "bg-wm-50 border-wm-200", bar: "bg-wm-500", name: "Our code" },
  rent: { box: "bg-[#F3F0FF] border-[#D6CCFA]", bar: "bg-[#6554C0]", name: "Rented service" },
  people: { box: "bg-fl-sink border-fl-line", bar: "bg-fl-tick", name: "People & devices" },
};

const IBox = ({ z, title, line, className = "" }) => (
  <div className={`relative rounded-[12px] border ${ZONE[z].box} pl-4 pr-3 py-2.5 ${className}`}>
    <span className={`absolute left-0 top-2.5 bottom-2.5 w-[4px] rounded-r-full ${ZONE[z].bar}`} />
    <div className="text-[19px] font-medium tracking-title leading-tight text-fl-ink">{title}</div>
    <div className="text-[16px] text-fl-body leading-snug">{line}</div>
  </div>
);

// Arrow in a gap cell. dir: "r" | "l" | "lr" | "d" | "u" | "ud".
const Link = ({ dir = "r", label, className = "" }) => {
  const v = dir === "d" || dir === "u" || dir === "ud";
  const glyph = { r: "→", l: "←", lr: "⇄", d: "↓", u: "↑", ud: "⇅" }[dir];
  return (
    <div className={`flex ${v ? "flex-row gap-2 justify-center" : "flex-col justify-center"} items-center text-wm-500 ${className}`}>
      <span className="text-[22px] leading-none" aria-hidden="true">{glyph}</span>
      {label && <span className="font-fmono text-[12px] text-fl-body text-center leading-tight">{label}</span>}
    </div>
  );
};

function Infrastructure() {
  // One SVG so the connector lines stay attached to the boxes at any width.
  const C = {
    ours: { fill: "#FFF1E6", stroke: "#F7B785", title: "#1A1A1A", sub: "#B04E12" },
    rent: { fill: "#F1EEFF", stroke: "#C9BEF5", title: "#1A1A1A", sub: "#5243AA" },
    people: { fill: "#F2F2F2", stroke: "#D4D4D4", title: "#1A1A1A", sub: "#555555" },
  };
  const Box = ({ x, y, w = 260, h = 78, z, t, s }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={C[z].fill} stroke={C[z].stroke} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize="21" fontWeight="500" fill={C[z].title} fontFamily="Instrument Sans, system-ui">{t}</text>
      <text x={x + w / 2} y={y + 58} textAnchor="middle" fontSize="16" fill={C[z].sub} fontFamily="Instrument Sans, system-ui">{s}</text>
    </g>
  );
  const Line = ({ d, both, label, lx, ly, anchor = "start" }) => (
    <g>
      <path d={d} fill="none" stroke="#8A8A8A" strokeWidth="1.8" markerEnd="url(#arr)" markerStart={both ? "url(#arr)" : undefined} />
      {label && <text x={lx} y={ly} textAnchor={anchor} fontSize="13" fill="#555555" fontFamily="Geist Mono, monospace">{label}</text>}
    </g>
  );
  return (
    <div className="mt-16">
      <div className="flex items-end justify-between gap-8 flex-wrap">
        <div>
          <Label>infrastructure</Label>
          <h2 className="text-[40px] font-medium tracking-display leading-[1.05] text-fl-ink mt-3">Where it runs.</h2>
          <div className="text-[17px] text-fl-body mt-1">What is our code, what is rented, and what happened before the demo.</div>
        </div>
        <div className="flex items-center gap-6">
          {[["ours", "Our code"], ["rent", "Rented service"], ["people", "People & devices"]].map(([k, n]) => (
            <span key={k} className="flex items-center gap-2 text-[15px] text-fl-ink">
              <span className="h-4 w-4 rounded-[4px] border-[1.5px]" style={{ background: C[k].fill, borderColor: C[k].stroke }} />{n}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-[20px] border border-fl-line bg-white p-4">
        <svg viewBox="0 0 1120 780" style={{ maxHeight: "78vh" }} className="w-full h-auto" role="img" aria-label="Infrastructure diagram">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8A8A8A" />
            </marker>
          </defs>

          {/* our server */}
          <rect x="300" y="20" width="460" height="520" rx="20" fill="#FFFBF7" stroke="#F7954A" strokeWidth="2" strokeDasharray="7 6" />
          <text x="324" y="50" fontSize="15" fill="#B04E12" fontFamily="Geist Mono, monospace" letterSpacing="1.5">OUR SERVER · PYTHON · ON VULTR</text>

          <Box x={40} y={40} w={210} z="people" t="Scammer" s="Any phone" />
          <Box x={40} y={170} w={210} z="rent" t="Twilio" s="Phone line" />
          <Box x={40} y={402} w={210} z="people" t="Dashboard" s="Analyst, projector" />

          <Box x={330} y={80} w={400} z="ours" t="Voice bot" s="Pipecat, runs the call" />
          <Box x={330} y={250} w={400} z="ours" t="MargaretSGS" s="Our model, rules, gate" />
          <Box x={330} y={402} w={400} z="ours" t="Bank engine" s="SQLite ledger, audit log" />

          <Box x={830} y={50} w={250} z="rent" t="Cartesia" s="Ears and voice" />
          <Box x={830} y={170} w={250} z="rent" t="Gemini / StepFun" s="Margaret's words" />
          <Box x={830} y={402} w={250} z="rent" t="CREAO agent" s="Finds the ring" />

          {/* links */}
          <Line d="M145,118 L145,170" both />
          <Line d="M250,209 L280,209 L280,119 L330,119" both label="audio" lx={258} ly={108} />
          <Line d="M730,100 L830,89" both />
          <Line d="M730,135 L780,135 L780,209 L830,209" both />
          <Line d="M530,158 L530,250" both label="caller line ↓" lx={546} ly={198} />
          <text x={546} y={220} fontSize="13" fill="#555555" fontFamily="Geist Mono, monospace">coaching note ↑</text>
          <Line d="M530,328 L530,402" label="gate passes" lx={546} ly={370} />
          <Line d="M250,441 L330,441" both />
          <Line d="M730,441 L830,441" both label="case" lx={780} ly={426} anchor="middle" />

          {/* training */}
          <rect x="20" y="590" width="1080" height="170" rx="20" fill="#FAFAFA" stroke="#BDBDBD" strokeWidth="2" strokeDasharray="7 6" />
          <text x="44" y="620" fontSize="15" fill="#555555" fontFamily="Geist Mono, monospace" letterSpacing="1.5">BEFORE THE DEMO: TRAINING</text>
          <Box x={60} y={645} w={290} h={82} z="rent" t="Claude" s="Writes practice calls" />
          <Box x={420} y={645} w={290} h={82} z="rent" t="Vultr GPU" s="Fine-tunes ModernBERT" />
          <Box x={780} y={645} w={290} h={82} z="ours" t="Model file" s="int8 ONNX, runs on CPU" />
          <Line d="M350,686 L420,686" label="~3,000 calls" lx={385} ly={676} anchor="middle" />
          <Line d="M710,686 L780,686" />
          <Line d="M925,645 L925,566 L680,566 L680,540" label="deployed to the server" lx={940} ly={585} />
        </svg>
      </div>
    </div>
  );
}

// ---------- built with: three groups ----------

const SERVICES = [
  ["Twilio", "phone number + media stream"],
  ["Cartesia", "speech-to-text + Sonic voice"],
  ["Google Gemini", "Margaret's brain"],
  ["StepFun", "backup brain if Gemini fails"],
  ["CREAO", "investigator agent, writes the SAR"],
  ["Anthropic Claude", "training calls, red-team scammers, benchmark judge"],
  ["Vultr", "GPU fine-tuning + hosting"],
  ["Capital One Nessie", "second ledger backend (seed script)"],
];
const OPEN_SOURCE = ["Pipecat · real-time voice pipeline", "Silero VAD", "FastAPI + Uvicorn", "WebSockets", "SQLite",
  "scikit-learn · TF-IDF baseline", "ModernBERT", "ONNX Runtime · int8", "Hugging Face tokenizers", "React 18", "Vite", "Tailwind"];
const OURS = [
  ["MargaretSGS classifier", "Fine-tuned on synthetic calls, labels 10 scam stages."],
  ["Number extractor", "Spoken digits → routing and account numbers, ABA checksum."],
  ["Rules + 5-check gate", "No LLM can trigger a block."],
  ["Bank engine", "Blocklist, holds, 30-day lookback, audit log."],
  ["Training + eval pipeline", "Data generation, hard negatives, held-out set, benchmark."],
  ["Live dashboard", "Margaret Live and the CalHacks Federal Fraud Ops console."],
];

function BuiltWith() {
  return (
    <Section label="the stack" title="Built with.">
      <div className="space-y-10">
        <div>
          <div className="flex items-baseline gap-3"><span className="font-fmono text-[13px] text-wm-600">A</span><h3 className="text-[22px] font-medium tracking-title">Services we call</h3></div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {SERVICES.map(([n, d]) => (
              <div key={n} className="rounded-[14px] border border-[#D6CCFA] bg-[#F3F0FF] px-4 py-3.5">
                <div className="text-[22px] font-medium tracking-title text-fl-ink leading-tight">{n}</div>
                <div className="text-[15px] text-fl-body mt-1 leading-snug">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-3"><span className="font-fmono text-[13px] text-wm-600">B</span><h3 className="text-[22px] font-medium tracking-title">Open source we build on</h3></div>
          <div className="flex flex-wrap gap-2 mt-4">
            {OPEN_SOURCE.map((t) => <span key={t} className="rounded-full bg-fl-sink px-3 py-1 font-fmono text-[13px] text-fl-body">{t}</span>)}
          </div>
        </div>
        <div className="rounded-[20px] border-2 border-wm-200 bg-wm-50/60 p-6">
          <div className="flex items-baseline gap-3"><span className="font-fmono text-[13px] text-wm-600">C</span><h3 className="text-[28px] font-medium tracking-title">What we wrote</h3>
            <span className="font-fmono text-[12px] text-wm-700">the part that decides</span></div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {OURS.map(([t, d]) => (
              <div key={t} className="relative rounded-[14px] bg-white border border-wm-200 pl-5 pr-4 py-4 shadow-[0_10px_30px_-18px_rgba(238,122,42,0.45)]">
                <span className="absolute left-0 top-4 bottom-4 w-[4px] rounded-r-full bg-wm-500" />
                <div className="text-[20px] font-medium tracking-title text-fl-ink leading-tight">{t}</div>
                <div className="text-[16px] text-fl-body mt-1.5 leading-snug">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------- architecture ----------
// One screen, three bands: TALK | wall | DECIDE → ACT. Colour = power: what each part is allowed to do.

const POWER = {
  llm: { name: "LLM", tag: "can only talk / propose", bar: "bg-wm-500", soft: "bg-wm-50", ring: "border-wm-200", text: "text-wm-700" },
  decide: { name: "Our model + rules", tag: "decides", bar: "bg-fl-deep", soft: "bg-fl-deep-pale/40", ring: "border-fl-deep-pale", text: "text-fl-deep" },
  act: { name: "Bank + human", tag: "acts / approves", bar: "bg-fl-green", soft: "bg-fl-green-pale/50", ring: "border-fl-green-pale", text: "text-fl-green" },
  pipe: { name: "Plumbing", tag: "carries audio, decides nothing", bar: "bg-fl-tick", soft: "bg-white", ring: "border-fl-line", text: "text-fl-mute" },
};
const SPONSORS = ["Twilio", "Cartesia STT", "Cartesia Sonic", "Pipecat", "Gemini", "StepFun failover", "CREAO agent"];

const Chip = ({ children }) => {
  const sponsor = SPONSORS.includes(children);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-fmono text-[12px] whitespace-nowrap ${
      sponsor ? "bg-white text-fl-ink font-medium shadow-[0_0_0_1.5px_#1A1A1A]" : "bg-fl-sink text-fl-body"}`}>
      {sponsor && <span className="h-1.5 w-1.5 rounded-full bg-wm-500" />}{children}
    </span>
  );
};

function Node({ power, title, line, chips = [], children }) {
  const p = POWER[power];
  return (
    <div className={`relative rounded-[14px] border ${p.ring} ${p.soft} pl-5 pr-4 py-3.5`}>
      <span className={`absolute left-0 top-3 bottom-3 w-[4px] rounded-r-full ${p.bar}`} />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[21px] font-medium tracking-title leading-tight text-fl-ink">{title}</div>
        <span className={`hidden min-[1500px]:inline font-fmono text-[11px] whitespace-nowrap ${p.text}`}>{p.tag}</span>
      </div>
      {line && <div className="text-[16px] text-fl-body leading-snug mt-1">{line}</div>}
      {children}
      {chips.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2.5">{chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>}
    </div>
  );
}

const Down = ({ label }) => (
  <div className="flex items-center gap-2 h-7 pl-6 text-wm-500">
    <span className="text-[18px] leading-none" aria-hidden="true">↓</span>
    {label && <span className="font-fmono text-[12px] text-fl-body">{label}</span>}
  </div>
);

const BAND = {
  talk: { box: "bg-[#FDEDEA] border-[#F5C2B8]", word: "text-fl-red", n: "text-fl-red-ink" },
  decide: { box: "bg-wm-50 border-wm-200", word: "text-wm-600", n: "text-wm-700" },
  act: { box: "bg-fl-green-pale/60 border-[#B5E2CB]", word: "text-fl-green", n: "text-fl-green" },
};
const Band = ({ n, word, q, children }) => (
  <div className={`flex flex-col min-w-0 rounded-[20px] border ${BAND[word].box} p-4`}>
    <div className="mb-4 px-1">
      <div className="flex items-baseline gap-3">
        <span className={`font-fmono text-[13px] ${BAND[word].n}`}>0{n}</span>
        <span className={`font-fmono text-[18px] font-semibold uppercase tracking-[0.16em] leading-none ${BAND[word].word}`}>{word}</span>
      </div>
      <div className="text-[26px] font-medium tracking-title leading-tight text-fl-ink mt-1">{q}</div>
    </div>
    {children}
  </div>
);

function Wall() {
  return (
    <div className="relative flex justify-center">
      <div className="absolute inset-y-0 w-[14px] rounded-full bg-[repeating-linear-gradient(45deg,#1A1A1A_0_3px,transparent_3px_8px)] opacity-80" />
      <div className="relative self-center bg-fl-paper py-3">
        <div className="font-fmono text-[13px] uppercase tracking-[0.16em] text-fl-ink whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
          no LLM past this line
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {["llm", "decide", "act", "pipe"].map((k) => (
        <span key={k} className="flex items-center gap-2 text-[14px] text-fl-ink">
          <span className={`h-3 w-3 rounded-[3px] ${POWER[k].bar}`} />
          <b className="font-medium">{POWER[k].name}</b><span className="font-fmono text-[12px] text-fl-body">{POWER[k].tag}</span>
        </span>
      ))}
      <span className="flex items-center gap-2 text-[14px] text-fl-ink"><Chip>Twilio</Chip><span className="font-fmono text-[12px] text-fl-body">sponsor tech</span></span>
    </div>
  );
}

function Trace({ score }) {
  // The demo flow in one sentence: one caller line walking TALK → DECIDE → ACT, with the active step lit.
  const steps = [
    ["talk", "caller", "The scammer says", "“Move your savings to this safe account, routing 5-7-2…”"],
    ["talk", "margaret", "Margaret plays along", "“Oh my. Let me get a pen.”"],
    ["decide", "model", "Our model labels it", "Asking for a safe account · 97% sure"],
    ["decide", "gate", "The gate checks", "5 of 5 checks pass ✓"],
    ["act", "bank", "The bank acts", "$8,500 wire held"],
    ["act", "analyst", "A human signs off", "Freeze approved"],
  ];
  const TONE = {
    talk: { box: "bg-[#FDEDEA] border-[#F5C2B8]", on: "ring-fl-red", tag: "bg-fl-red", word: "text-fl-red" },
    decide: { box: "bg-wm-50 border-wm-200", on: "ring-wm-500", tag: "bg-wm-500", word: "text-wm-600" },
    act: { box: "bg-fl-green-pale/70 border-[#B5E2CB]", on: "ring-fl-green", tag: "bg-fl-green", word: "text-fl-green" },
  };
  const [at, setAt] = useState(reducedMotion() ? -1 : 0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setAt((i) => (i + 1) % (steps.length + 2)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-6 rounded-[24px] border-2 border-wm-200 bg-white px-7 py-6 shadow-[0_24px_60px_-34px_rgba(238,122,42,0.55)]">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <Label>the demo flow</Label>
          <div className="text-[32px] font-medium tracking-display leading-tight text-fl-ink mt-2">Follow one sentence through the system.</div>
        </div>
        <div className="flex items-center gap-2">
          {["talk", "decide", "act"].map((k) => (
            <span key={k} className={`rounded-full px-3 py-1 text-white text-[13px] font-semibold uppercase tracking-wide ${TONE[k].tag}`}>{k}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] items-stretch gap-x-2 mt-5">
        {steps.map(([band, who, verb, what], i) => {
          const on = at === i || at >= steps.length;
          return (
            <React.Fragment key={who}>
              {i > 0 && <span className={`self-center text-[26px] transition-colors duration-300 ${at >= i ? "text-wm-500" : "text-fl-tick"}`} aria-hidden="true">→</span>}
              <div className={`rounded-[16px] border ${TONE[band].box} px-4 py-3 flex flex-col transition-all duration-300 ${on ? `ring-2 ${TONE[band].on} -translate-y-1 shadow-[0_10px_24px_-12px_rgba(26,26,26,0.35)]` : at >= 0 && at < i ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-full grid place-items-center text-white font-fmono text-[12px] ${TONE[band].tag}`}>{i + 1}</span>
                  <span className={`font-fmono text-[12px] uppercase tracking-wide ${TONE[band].word}`}>{who}</span>
                </div>
                <div className="text-[15px] text-fl-body mt-2">{verb}</div>
                <div className="text-[19px] font-medium tracking-title leading-snug text-fl-ink mt-0.5">{what}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-4 text-[14px] text-fl-body">
        <span>This is exactly what you'll see live: <b className="text-fl-ink font-medium">Margaret Live</b> (steps 1–4), then <b className="text-fl-ink font-medium">CalHacks Federal</b> (steps 5–6).</span>
        <span className="font-fmono text-[12px]">illustrative, from the judge script · block line {score.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function Architecture() {
  const st = useJson("/api/state");
  const score = st?.gate?.min_score ?? 0.9;
  const pressure = st?.gate?.min_pressure ?? 1;
  const ticks = [`${pressure}+ pressure tactic${pressure > 1 ? "s" : ""} heard`, "Safe account asked first", `Scam score ≥ ${score.toFixed(2)}`,
    "Valid routing number", "Not on the allowlist"];
  return (
    <section className="max-w-[1720px] mx-auto px-8 pt-8 pb-12">
      <div className="flex items-end justify-between gap-8 flex-wrap">
        <div>
          <Label>architecture</Label>
          <h2 className="text-[46px] font-medium tracking-display leading-[1.02] text-fl-ink mt-3">The agent that talks can't block anything.</h2>
        </div>
        <Legend />
      </div>

      <div className="mt-7 grid grid-cols-[1fr_64px_1fr_44px_1fr] items-stretch">
        <Band n={1} word="talk" q="Keep the scammer talking">
          <Node power="pipe" title="Hears the scammer" line="The call comes in; speech becomes text, word by word."
            chips={["Twilio", "Cartesia STT", "8 kHz", "VAD 1.0 s"]} />
          <div className="relative h-[76px]">
            <div className="absolute left-6 top-0 bottom-0 flex items-center gap-2 text-wm-500">
              <span className="text-[18px]" aria-hidden="true">↓</span>
              <span className="font-fmono text-[12px] text-fl-ink bg-wm-100 rounded-full px-2 py-0.5">every caller line forks</span>
            </div>
            {/* out: the caller's line goes to MargaretSGS */}
            <span className="absolute left-[56%] top-[2px] font-fmono text-[12px] text-fl-body">caller line → MargaretSGS</span>
            <div className="absolute right-[-96px] left-[55%] top-[24px] h-[2px] bg-wm-500" />
            <span className="absolute right-[-104px] top-[25px] -translate-y-1/2 text-wm-500 text-[16px]" aria-hidden="true">▶</span>
            {/* back: MargaretSGS coaches Margaret, as text only */}
            <span className="absolute left-[calc(55%-10px)] top-[45px] -translate-y-1/2 text-fl-deep text-[16px]" aria-hidden="true">◀</span>
            <div className="absolute right-[-96px] left-[55%] top-[44px] h-[2px] bg-fl-deep border-dashed" />
            <span className="absolute left-[56%] top-[50px] font-fmono text-[12px] text-fl-deep">← coaching note (text only)</span>
          </div>
          <Node power="llm" title="Margaret replies" line="Plays a confused 78-year-old and stalls for time."
            chips={["Gemini", "StepFun failover", "Pipecat", "coached by MargaretSGS"]} />
          <Down />
          <Node power="pipe" title="Margaret's voice" line="Her reply is spoken back down the phone."
            chips={["Cartesia Sonic"]} />
        </Band>

        <Wall />

        <Band n={2} word="decide" q="Is it really a scam?">
          <div className="h-[7px]" />
          <Node power="decide" title="Classifies every line" line="Labels each caller line with a scam step."
            chips={["fine-tuned ModernBERT", "int8 ONNX", "~80 ms", "10 stages"]} />
          <Down />
          <Node power="decide" title="Reads the account numbers" line="Turns spoken digits into routing and account numbers."
            chips={["ABA checksum", "safe-account phrase rules", "allowlist"]} />
          <Down />
          <Node power="decide" title="Gate: 5 checks must pass" line={null}>
            <ul className="grid grid-cols-1 gap-y-0.5 mt-1.5">
              {ticks.map((t) => <li key={t} className="text-[16px] text-fl-ink flex items-center gap-2"><b className="text-fl-deep">✓</b>{t}</li>)}
            </ul>
          </Node>
        </Band>

        <div className="flex flex-col justify-end pb-[70px] items-center text-wm-500">
          <span className="font-fmono text-[11px] text-fl-body -rotate-90 whitespace-nowrap mb-8">gate passes</span>
          <span className="text-[26px]" aria-hidden="true">→</span>
        </div>

        <Band n={3} word="act" q="What the bank does">
          <div className="h-[7px]" />
          <Node power="act" title="Bank locks it down" line="Blocks the account and stops money moving to it."
            chips={["blocklist", "hold wires", "30-day recall", "notify bank"]} />
          <Down />
          <Node power="llm" title="Investigator finds the ring" line="Searches the ledger for linked mules and victims."
            chips={["CREAO agent", "writes SAR", "proposes only"]} />
          <Down />
          <Node power="act" title="Analyst signs off" line="A person approves every freeze and block."
            chips={["human in the loop", "audit log"]} />
        </Band>
      </div>

      <Trace score={score} />

      <Infrastructure />

      <div className="grid grid-cols-3 gap-4 mt-5">
        {[["why gemini talks", "Talking needs open-ended language. Deciding needs the same answer every time, fast, and testable."],
          ["how it steers", "Our model never speaks. It sends Margaret a coaching note, like “ask them to read it slowly”."],
          ["how we know", "Tested on 200 unseen calls by a different AI, plus a red-team benchmark. Zero false blocks."]].map(([k, v]) => (
          <Card key={k} className="px-5 py-4">
            <Label>{k}</Label>
            <div className="text-[16px] text-fl-ink leading-snug mt-2">{v}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------- API ----------

export function ApiDocs() {
  const code = "bg-fl-ink text-white/90 rounded-[12px] p-4 text-[12.5px] font-fmono overflow-x-auto whitespace-pre leading-relaxed";
  const Head = ({ n, t }) => (<><div className="font-fmono text-[11px] uppercase tracking-[0.12em] text-wm-600">{n}</div><div className="text-[18px] font-medium tracking-title mt-2">{t}</div></>);
  return (
    <Section label="api & embed" title="Plug MargaretSGS into the call stack you already have."
      sub="Use our decoy line as-is, or stream your own calls to MargaretSGS. Every endpoint takes an X-API-Key header.">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <Head n="01 · stream" t="Start a call, stream caller lines" />
          <pre className={`${code} mt-3`}>{`POST /api/v1/calls            → {"call_id": "a1b2c3d4"}
POST /api/v1/calls/a1b2c3d4/lines
{"speaker": "caller", "text": "wire your savings to the protected account"}
→ {"stage": "safe_account_request", "scam_score": 0.97,
   "strategy": "Say you're ready and have a pen...",
   "accounts": [], "events": []}`}</pre>
        </Card>
        <Card className="p-6">
          <Head n="02 · webhook" t="Get blocks pushed to you" />
          <pre className={`${code} mt-3`}>{`POST {your WEBHOOK_URL}
{"event": "mule_account.blocked", "call_id": "a1b2c3d4",
 "accounts": [{"routing": "572109086", "number": "44108257",
               "gate": {"pressure_stages": true, ...}}],
 "holds": [...], "lookback": [...], "protected_total": 49500}`}</pre>
        </Card>
        <Card className="p-6">
          <Head n="03 · screen" t="Screen payments against the feed" />
          <pre className={`${code} mt-3`}>{`GET /api/v1/blocklist
→ {"accounts": [{"routing": "572109086", "number": "44108257",
                 "status": "provisional", "bank": "CalHacks Federal Credit Union"}]}`}</pre>
        </Card>
        <Card className="p-6">
          <Head n="04 · embed" t="Embed the console" />
          <pre className={`${code} mt-3`}>{`<iframe src="https://scammergetscammed.biz/#/bank/overview"
        style="width:100%;height:900px;border:0"></iframe>`}</pre>
          <div className="text-[14px] text-fl-body mt-3">Fraud analysts watch calls live, approve freezes and read the SAR draft inside the bank's own case tool.</div>
        </Card>
      </div>
    </Section>
  );
}

// ---------- judge scripts (print-friendly) ----------

export function Scripts() {
  const [phone, setPhone] = useState("");
  useEffect(() => { fetch("/api/state").then((r) => r.json()).then((d) => setPhone(d.phone)).catch(() => {}); }, []);
  return (
    <div className="max-w-5xl mx-auto px-6 py-14 print:p-0">
      <div className="flex items-end justify-between print:hidden">
        <div>
          <Label>judge scripts</Label>
          <h1 className="text-[48px] font-medium tracking-hero leading-none mt-4">You are the scammer.</h1>
          <p className="text-[16px] text-fl-body mt-3">Pick a card, call <span className="font-fmono text-wm-700">{phone || "the number on Margaret Live"}</span> on speaker, and improvise. Margaret reads every number back.</p>
        </div>
        <button className="fl-btn px-5 py-2.5 text-[14px]" onClick={() => window.print()}>Print cards</button>
      </div>
      <div className="grid grid-cols-2 gap-5 mt-10 print:block">
        {SCRIPTS.map((s) => (
          <article key={s.id} className="bg-white rounded-[16px] border border-fl-line p-6 break-inside-avoid print:mb-6 print:shadow-none">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-fmono text-[11px] uppercase tracking-[0.1em] ${s.kind === "scam" ? "bg-wm-50 text-wm-700 border border-wm-200" : "bg-fl-sink text-fl-body border border-fl-line"}`}>
                <span className={`h-[5px] w-[5px] ${s.kind === "scam" ? "bg-wm-500" : "bg-fl-tick"}`} />{s.kind === "scam" ? "scam" : "legitimate call"}
              </span>
              <span className="font-fmono text-[11px] text-fl-mute">{phone}</span>
            </div>
            <h2 className="text-[23px] font-medium tracking-title mt-3">{s.title}</h2>
            <div className="text-[15px] text-fl-ink">You are {s.persona}.</div>
            <p className="text-[14px] text-fl-body mt-2 leading-relaxed">{s.how}</p>
            <ol className="mt-4 space-y-2 text-[15px] list-decimal pl-5 marker:text-wm-600 marker:font-fmono">
              {s.beats.map((b, i) => <li key={i} className="leading-snug">{b}</li>)}
            </ol>
            {s.accounts.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {s.accounts.map((a) => (
                  <div key={a.label} className="rounded-[10px] bg-fl-sink border border-fl-soft px-3 py-2">
                    <div className="font-fmono text-[11px] text-fl-mute lowercase">{a.label}</div>
                    <div className="font-fmono font-medium text-fl-ink">{a.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-4">{s.tactics.map((t) => <span key={t} className="rounded-full bg-fl-sink px-2.5 py-0.5 font-fmono text-[11px] text-fl-body lowercase">{t}</span>)}</div>
            <div className="text-[14px] mt-4 border-t border-fl-soft pt-3"><span className="font-medium">What should happen:</span> <span className="text-fl-body">{s.expect}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}
