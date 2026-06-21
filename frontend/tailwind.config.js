/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          300: 'var(--color-primary-300)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover:   'var(--color-accent-hover)',
          soft:    'var(--color-accent-soft)',
        },
        // Surfaces / chrome (theme-aware via CSS vars)
        surface: {
          base: 'var(--surface-base)',
          card: 'var(--surface-card)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          strong:  'var(--border-strong)',
        },
        // Text hierarchy
        ink: {
          0: 'var(--text-primary)',
          1: 'var(--text-secondary)',
          2: 'var(--text-tertiary)',
          3: 'var(--text-quaternary)',
          4: 'var(--text-disabled)',
        },
        // Status
        success: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        warning: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        danger:  { DEFAULT: 'var(--color-danger)',  bg: 'var(--color-danger-bg)' },
        info:    { DEFAULT: 'var(--color-info)',    bg: 'var(--color-info-bg)' },
        // Severity scale (alerts)
        severity: {
          critical: 'var(--sev-critical)',
          high:     'var(--sev-high)',
          medium:   'var(--sev-medium)',
          low:      'var(--sev-low)',
          info:     'var(--sev-info)',
        },
        // Chart categorical palette
        chart: {
          1: 'var(--chart-1)', 2: 'var(--chart-2)', 3: 'var(--chart-3)',
          4: 'var(--chart-4)', 5: 'var(--chart-5)', 6: 'var(--chart-6)',
          7: 'var(--chart-7)',
        },
        // Legacy aliases kept for any class still referencing "neon-*"
        // (mapped onto the new semantic tokens so old usages still render correctly)
        neon: {
          green:  'var(--color-success)',
          red:    'var(--color-danger)',
          amber:  'var(--color-warning)',
          blue:   'var(--color-info)',
          purple: 'var(--chart-5)',
          cyan:   'var(--color-accent)',
        },
      },
      borderRadius: {
        card:   '16px',
        btn:    '12px',
        input:  '12px',
        modal:  '20px',
      },
      boxShadow: {
        card:      '0 4px 12px rgba(15,23,42,0.05)',
        'card-hover': '0 12px 24px rgba(15,23,42,0.08)',
        'focus-ring': '0 0 0 4px rgba(37,99,235,0.15)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '0.5x': '4px',
        '1x': '8px', '2x': '16px', '3x': '24px', '4x': '32px',
      },
      transitionDuration: { 150: '150ms', 200: '200ms', 250: '250ms' },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
