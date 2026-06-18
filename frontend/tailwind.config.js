/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#060a0f',
          1: '#0a0f16',
          2: '#0f1621',
          3: '#141d2b',
          4: '#1a2537',
        },
        neon: {
          green:  '#00ff88',
          red:    '#ff4757',
          amber:  '#fbbf24',
          blue:   '#60a5fa',
          purple: '#a78bfa',
          cyan:   '#22d3ee',
        },
        ink: {
          0:  '#e2e8f0',
          1:  '#94a3b8',
          2:  '#64748b',
          3:  '#475569',
          4:  '#334155',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
