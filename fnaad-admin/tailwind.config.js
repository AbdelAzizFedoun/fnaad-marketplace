/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0A0C",
        surface: "#141216",
        border: "#2A272C",
        gold: "#C9A24B",
        "gold-light": "#E7C878",
        text: "#F0ECE4",
        muted: "#9C979E",
        faint: "#7D7880",
        danger: "#B0524F",
        success: "#5FA779",
        info: "#4A90D9",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
