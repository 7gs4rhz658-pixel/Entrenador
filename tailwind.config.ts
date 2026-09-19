import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        serie: "var(--serie)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};

export default config;
