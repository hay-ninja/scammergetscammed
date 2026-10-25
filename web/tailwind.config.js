/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "monospace"],
        // Product site + Margaret Live (tryflow.study-style): Instrument Sans with Geist Mono micro-labels.
        flow: ["Instrument Sans", "system-ui", "sans-serif"], fmono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Bay Federal brand: deep navy like most US bank portals, teal accent.
        navy: { 950: "#061A33", 900: "#0A2540", 800: "#12355B", 700: "#1B4A7A", 100: "#E6EEF7", 50: "#F2F6FB" },
        teal: { 600: "#0E8C86", 500: "#14A39C", 100: "#DDF5F3", 50: "#EFFAF9" },
        page: "#F4F6F9",
        line: "#E3E8EF",
        ink: { 900: "#0F1B2D", 700: "#33415C", 500: "#64748B", 400: "#8A96A8" },
        // Bay Federal Fraud Ops console (Jira layout, Bank of America-like colours).
        bf: {
          navy: "#012169", navy2: "#0A2E8A", red: "#E31837", bg: "#F4F5F7", line: "#DFE1E6", ink: "#172B4D",
          sub: "#5E6C84", green: "#00875A", amber: "#FF991F", blue: "#0052CC", hover: "#EBECF0",
        },
        // Margaret Live (airy lavender cards).
        lav: { 50: "#F3EFFC", 100: "#E9E3FA", 200: "#D9D0F5", indigo: "#5B5BD6", soft: "#ECEBFF", ink: "#1E1B3A", sub: "#6B6890" },
        // Neutral paper palette (product site + Margaret Live).
        fl: {
          paper: "#FAFAFA", raise: "#FFFFFF", sink: "#F4F4F4", line: "#E2E2E2", soft: "#EBEBEB", tick: "#C4C4C4",
          ink: "#1A1A1A", body: "#555555", mute: "#6E6E6E", deep: "#2457E6", "deep-pale": "#DCE5FC",
          red: "#E0492F", "red-ink": "#A8341F", "red-pale": "#FBE1D9", amber: "#C9962E", "amber-pale": "#F7EDD3",
          green: "#157F55", "green-pale": "#DDF1E7",
        },
        // Warm accent for stats and highlights (white + warm orange, Giga-inspired).
        wm: { 50: "#FFF7F0", 100: "#FFEBDA", 200: "#FFD3AE", 400: "#F7954A", 500: "#EE7A2A", 600: "#D9631A", 700: "#B04E12", ink: "#2A1A0E" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.04)",
        raised: "inset 0 1px 0 #fff, 0 0 0 1px #E2E2E2, 0 1px 2px rgba(26,26,26,0.08)",
        primary: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 2px rgba(26,26,26,0.3), 0 3px 8px rgba(26,26,26,0.14)",
        groove: "inset 0 1px 2px rgba(26,26,26,0.09)",
        alert: "0 0 0 1px #E2E2E2, 0 2px 4px rgba(26,26,26,0.05), 0 24px 60px rgba(26,26,26,0.16)",
      },
      letterSpacing: { hero: "-0.05em", display: "-0.045em", title: "-0.04em" },
      keyframes: {
        flash: { "0%": { opacity: 0 }, "8%": { opacity: 1 }, "85%": { opacity: 1 }, "100%": { opacity: 0 } },
        pop: { "0%": { transform: "translateY(4px)", opacity: 0 }, "100%": { transform: "translateY(0)", opacity: 1 } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.45)" }, "100%": { boxShadow: "0 0 0 10px rgba(220,38,38,0)" } },
        slideIn: { "0%": { transform: "translateY(-16px)", opacity: 0, maxHeight: 0 }, "100%": { transform: "translateY(0)", opacity: 1, maxHeight: "260px" } },
        flipRow: { "0%": { backgroundColor: "#FFEBE6" }, "45%": { backgroundColor: "#FFEBE6" }, "100%": { backgroundColor: "#E3FCEF" } },
        glow: { "0%": { boxShadow: "0 0 0 0 rgba(227,24,55,0.55)" }, "100%": { boxShadow: "0 0 0 18px rgba(227,24,55,0)" } },
      },
      animation: {
        flash: "flash 3.4s ease-out forwards", pop: "pop 0.3s ease-out", pulseRing: "pulseRing 1.4s ease-out infinite",
        slideIn: "slideIn 0.5s ease-out", flipRow: "flipRow 1.6s ease-out forwards", glow: "glow 1.2s ease-out 3",
      },
    },
  },
  plugins: [],
};
