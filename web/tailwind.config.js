/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
      colors: {
        // Bay Federal brand: deep navy like most US bank portals, teal accent.
        navy: { 950: "#061A33", 900: "#0A2540", 800: "#12355B", 700: "#1B4A7A", 100: "#E6EEF7", 50: "#F2F6FB" },
        teal: { 600: "#0E8C86", 500: "#14A39C", 100: "#DDF5F3", 50: "#EFFAF9" },
        page: "#F4F6F9",
        line: "#E3E8EF",
        ink: { 900: "#0F1B2D", 700: "#33415C", 500: "#64748B", 400: "#8A96A8" },
      },
      boxShadow: { card: "0 1px 2px rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.04)" },
      keyframes: {
        flash: { "0%": { opacity: 0 }, "8%": { opacity: 1 }, "85%": { opacity: 1 }, "100%": { opacity: 0 } },
        pop: { "0%": { transform: "translateY(4px)", opacity: 0 }, "100%": { transform: "translateY(0)", opacity: 1 } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.45)" }, "100%": { boxShadow: "0 0 0 10px rgba(220,38,38,0)" } },
      },
      animation: { flash: "flash 3.4s ease-out forwards", pop: "pop 0.3s ease-out", pulseRing: "pulseRing 1.4s ease-out infinite" },
    },
  },
  plugins: [],
};
