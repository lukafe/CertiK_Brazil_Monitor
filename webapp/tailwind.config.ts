import type { Config } from "tailwindcss";

/*
 * Paleta CertiK Skynet (hex extraídos dos assets de produção de skynet.certik.com).
 * IMPORTANTE: os mesmos hex existem como CSS vars em app/globals.css (para SVGs).
 * Mantenha os dois arquivos em sincronia.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          sunken: "#101218",
          DEFAULT: "#171921",
          raised: "#1d2029",
          overlay: "#232734",
        },
        edge: {
          DEFAULT: "#262a35",
          strong: "#363b48",
        },
        fg: {
          DEFAULT: "#f4f4f4",
          secondary: "#a0a1a6",
          muted: "#616161",
        },
        accent: {
          DEFAULT: "#5ef2b8",
          bright: "#4efac9",
          deep: "#0f2b21",
          on: "#171921",
        },
        info: {
          DEFAULT: "#25a6f5",
          light: "#8bddff",
        },
        alert: {
          DEFAULT: "#ff4b4b",
          deep: "#e5453d",
        },
        score: {
          1: "#258c67",
          2: "#799f46",
          3: "#cdb225",
          4: "#d99728",
          5: "#d94828",
        },
        grade: {
          aaa: "#258c67",
          aa: "#4f9657",
          a: "#799f46",
          bbb: "#cdb225",
          bb: "#d99728",
          b: "#d97028",
          d: "#d94828",
        },
        // marca CertiK — uso exclusivo do ShieldLogo
        logo: "#d5114d",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
