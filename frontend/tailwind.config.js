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
        sentinel: {
          bg: '#0a0d14',
          card: '#111722',
          border: '#1f293d',
          accent: '#00f2fe',
          cyan: '#38bdf8',
          green: '#10b981',
          yellow: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
          purple: '#8b5cf6',
          dark: '#07090e'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radar 3s linear infinite',
        'glow-red': 'glowRed 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        glowRed: {
          '0%': { boxShadow: '0 0 10px rgba(239, 68, 68, 0.4), inset 0 0 10px rgba(239, 68, 68, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(239, 68, 68, 0.8), inset 0 0 20px rgba(239, 68, 68, 0.5)' }
        }
      }
    },
  },
  plugins: [],
}

