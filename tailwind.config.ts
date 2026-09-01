import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brisbane Rendering brand: deep navy + teal (from the logo)
        ink: '#0b2038',
        stone: {
          50: '#f6f8fa',
          100: '#eaeef2',
          200: '#d5dde4',
          300: '#aebcc8',
          400: '#7a8b99',
          500: '#556575',
        },
        brand: {
          DEFAULT: '#1596b8',
          dark: '#0e7591',
          light: '#3fb8d6',
        },
        navy: {
          DEFAULT: '#0b2038',
          light: '#16324f',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        lift: '0 20px 60px -20px rgba(0,0,0,0.35)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        fadeup: 'fadeup 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
