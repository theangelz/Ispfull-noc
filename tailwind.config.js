/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // NOC dark palette
        bg: {
          main: "#050505",
          panel: "#0f0f0f",
          soft: "#151515",
          elevated: "#1a1a1a",
        },
        border: {
          DEFAULT: "#242424",
          soft: "#1c1c1c",
          strong: "#3a3a3a",
        },
        fg: {
          DEFAULT: "#d6d6d6",
          soft: "#8a8a8a",
          dim: "#5a5a5a",
        },
        accent: {
          blue: "#00bfff",
          cyan: "#00d9ff",
          green: "#5cff72",
          orange: "#ff9d00",
          red: "#ff4d4d",
          yellow: "#ffd83d",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
        sans: ["Inter", "SF Pro", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "10px",
      },
      boxShadow: {
        "glow-blue": "0 0 10px rgba(0, 191, 255, 0.2)",
        "glow-green": "0 0 10px rgba(92, 255, 114, 0.2)",
      },
    },
  },
  plugins: [],
};
