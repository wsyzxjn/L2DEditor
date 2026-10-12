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
        'dcc': '11px',
        'dcc-sm': '10px'
      }
    },
  },
  plugins: [],
}
