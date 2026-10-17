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
        // Defined once in src/theme.css (:root --dcc-*).
        dcc: {
          bg: 'rgb(var(--dcc-bg) / <alpha-value>)',
          panel: 'rgb(var(--dcc-panel) / <alpha-value>)',
          header: 'rgb(var(--dcc-header) / <alpha-value>)',
          border: 'rgb(var(--dcc-border) / <alpha-value>)',
          hover: 'rgb(var(--dcc-hover) / <alpha-value>)',
          raised: 'rgb(var(--dcc-raised) / <alpha-value>)',
          canvas: 'rgb(var(--dcc-canvas) / <alpha-value>)',
          text: 'rgb(var(--dcc-text) / <alpha-value>)',
          control: 'rgb(var(--dcc-control) / <alpha-value>)',
          muted: 'rgb(var(--dcc-muted) / <alpha-value>)',
          subtle: 'rgb(var(--dcc-subtle) / <alpha-value>)',
          accent: 'rgb(var(--dcc-active) / <alpha-value>)',
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
