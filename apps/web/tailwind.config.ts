import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Oswald', 'system-ui', 'sans-serif'],
        body: ['Ubuntu', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Ubuntu Mono', 'ui-monospace', 'monospace']
      },
      colors: {
        labelhub: {
          primary: '#072C2C',
          accent: '#FF5F03',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          bg: '#EDEADE',
          surface: '#FFFFFF'
        }
      }
    }
  },
  plugins: [],
};
export default config;
