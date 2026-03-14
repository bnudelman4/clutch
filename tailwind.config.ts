import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0d",
        surface: "#141414",
        border: "#1e1e1e",
        accent: "#00ff88",
        "accent-dim": "#00ff8833",
        muted: "#666666",
        amber: "#ffaa00",
        danger: "#ff4444",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        heading: ["Syne", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
