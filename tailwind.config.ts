import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // Dossier app
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // Dossier components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;