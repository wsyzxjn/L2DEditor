/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dcc: {
          bg: '#141416',
          panel: '#1c1c1f',
          header: '#242429',
          border: '#2e2e36',
          hover: '#383842',
          accent: '#3b82f6',
          text: '#f4f4f5',
          muted: '#a1a1aa'
        }
      },
      fontSize: {
        // 12px body text, 11px controls, 10px only for rulers, IDs and counters.
        'dcc': '12px',
        'dcc-sm': '11px',
        'dcc-xs': '10px'
      }
    },
  },
  plugins: [],
}
