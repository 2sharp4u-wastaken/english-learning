import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      borderRadius: {
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        glow: 'var(--shadow-glow)',
      },
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface-1)',
        'surface-2': 'var(--color-surface-2)',
        text: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        learn: 'var(--color-learn)',
        practice: 'var(--color-practice)',
        challenge: 'var(--color-challenge)',
        test: 'var(--color-test)',
        'accent-blue': 'var(--blue-400)',
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
      },
    },
  },
} satisfies Config
