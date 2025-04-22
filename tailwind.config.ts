import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}", // If using pages router
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // For app router
  ],
  theme: {
    extend: {
      fontFamily: {
        // Keep sans if needed for specific elements later
        sans: ["Inter", "system-ui", "sans-serif"],
        // Make mono use the Roboto Mono variable
        mono: ["var(--font-roboto-mono)", "monospace"],
      },
      // Add other theme extensions if needed
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config; 