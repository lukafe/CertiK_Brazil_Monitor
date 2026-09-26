import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0d10",
          900: "#121417",
          800: "#16191d",
          700: "#1d2126",
          600: "#262b31",
        },
        edge: "#23272d",
        certik: {
          DEFAULT: "#3fe0a8",
          bright: "#4ef0b6",
          dim: "#123126",
          deep: "#0d2b20",
        },
        brand: {
          DEFAULT: "#d5114d",
          bright: "#f0356e",
        },
      },
    },
  },
  plugins: [],
};
export default config;
