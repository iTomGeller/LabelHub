import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#072C2C",
        accent: "#FF5F03",
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        surface: "#EDEADE",
        ink: "#111827"
      },
      fontFamily: {
        sans: ["Ubuntu", "Inter", "system-ui", "sans-serif"],
        display: ["Oswald", "Ubuntu", "system-ui", "sans-serif"],
        mono: ["Ubuntu Mono", "JetBrains Mono", "monospace"]
      },
      boxShadow: {
        panel: "0 18px 50px rgba(7, 44, 44, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
