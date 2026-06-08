/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#F8F7F4",
        white: "#FFFFFF",
        ground: "#F0EEE9",
        rule: "#E2DED6",
        "rule-hi": "#C8C3B8",
        ink: "#131210",
        "ink-2": "#3D3B37",
        "ink-3": "#8C8980",
        "ink-4": "#BAB7B0",
        volt: "#2D4EFF",
        "volt-light": "#EEF1FF",
        forest: "#1A6B45",
        "forest-light": "#E8F4EE",
        amber: "#8B5200",
        "amber-light": "#FDF3E7",
        danger: "#8B1A1A",
        "danger-light": "#FDF0F0",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Epilogue", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
};
