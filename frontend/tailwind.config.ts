import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#12181B",
        "ink-dark": "#E7ECEF",
        paper: "#F7F7F5",
        "paper-dark": "#0B0F14",
        surface: "#FFFFFF",
        "surface-dark": "#12181F",
        accent: {
          DEFAULT: "#0E7C7B",
          light: "#14A3A1",
          dark: "#0A5F5E",
        },
        warn: "#C2622A",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;