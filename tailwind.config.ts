import type { Config } from "tailwindcss";

// Los colores viven como variables CSS (globals.css). Las clases con
// opacidad (border-ok/40, bg-accent/10…) salen con color-mix; con
// "var(--x)" a secas Tailwind no las generaba. Sin opacidad queda el
// var() de siempre, que funciona en cualquier teléfono. (Tailwind acepta
// colores como función aunque sus tipos no lo declaren.)
const color = (variable: string) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined || opacityValue === "1" || opacityValue.startsWith("var(")
      ? `var(${variable})`
      : `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`) as unknown as string;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: color("--bg"),
        surface: color("--surface"),
        surface2: color("--surface-2"),
        line: color("--line"),
        ink: color("--ink"),
        muted: color("--muted"),
        accent: color("--accent"),
        "accent-ink": color("--accent-ink"),
        ok: color("--ok"),
        warn: color("--warn"),
        danger: color("--danger"),
        serie: color("--serie")
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
};

export default config;
