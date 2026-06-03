/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: "#6b1f2a", 50: "#fbf4f5", 100: "#f6e7e9", 600: "#7a2230", 700: "#5f1822" },
        ink: { DEFAULT: "#1c1c1e", muted: "#6b6b70" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
