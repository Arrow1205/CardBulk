import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'app-dark': '#0F1115',
        'app-neon': '#DFFF00',
        'app-purple': '#8B5CF6',
      },
    },
  },
  plugins: [],
};
export default config;