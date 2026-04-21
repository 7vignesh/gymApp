import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont",
          "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
      },
      colors: {
        brand: {
          50:  "#ecfdf5",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        ink: {
          900: "#07080c",
          800: "#0b0d14",
          700: "#0f1117",
          600: "#151823",
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(6,182,212,0.18) 100%)",
        "shimmer": "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
      },
      boxShadow: {
        "glow-brand": "0 10px 40px -10px rgba(16, 185, 129, 0.55)",
        "glow-accent": "0 10px 40px -10px rgba(167, 139, 250, 0.5)",
        "card": "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -15px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-in":    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "fade-up":    { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "fade-down":  { "0%": { opacity: "0", transform: "translateY(-8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in":   { "0%": { opacity: "0", transform: "scale(0.96)" }, "100%": { opacity: "1", transform: "scale(1)" } },
      },
      animation: {
        "fade-in":   "fade-in 0.35s ease-out both",
        "fade-up":   "fade-up 0.45s cubic-bezier(0.2,0.7,0.2,1) both",
        "fade-down": "fade-down 0.35s ease-out both",
        "scale-in":  "scale-in 0.3s cubic-bezier(0.2,0.7,0.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
