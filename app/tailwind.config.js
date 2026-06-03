/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // UChicago-inspired dark palette
        bg: "#131216",
        surface: "#1b1920",
        surface2: "#242129",
        line: "#332f3b",
        txt: "#ECEAEF",
        muted: "#9c97a6",
        maroon: {
          DEFAULT: "#800000",   // UChicago maroon
          deep: "#5f0014",
          mid: "#9e2a3e",
          light: "#c75d72",     // readable accent on dark
        },
        gold: { DEFAULT: "#EAAA00", soft: "#f6cd5b" },
        good: "#3fb98f",
        warn: "#e0a93b",
        danger: "#e0683f",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
