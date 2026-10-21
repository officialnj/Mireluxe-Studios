import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#1a1a1a',
          soft: '#232323',
          muted: '#2c2c2c',
        },
        cream: {
          DEFAULT: '#f5f1ea',
          soft: '#ede7dc',
          deep: '#e4dccd',
        },
        // Warm, light surfaces for the admin dashboard (Acuity-style) — a
        // touch brighter than `cream` so white cards still read as raised.
        ivory: {
          DEFAULT: '#faf8f3',
          soft: '#f4efe6',
          deep: '#ece5d8',
        },
        gold: {
          DEFAULT: '#b08d57',
          light: '#c6a678',
          dark: '#98763f',
        },
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        luxe: '0.28em',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.8s ease forwards',
      },
    },
  },
  plugins: [],
};

export default config;
