/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0c',
        surface: '#0f172a',
        surface2: '#111827',
        border: '#1e293b',
        accent: {
          cyan: '#22d3ee',
          violet: '#a855f7',
        },
        text: {
          primary: '#ffffff',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
        tg: '#2481cc',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 10px 25px -5px rgba(147, 51, 234, 0.4)',
        glowCyan: '0 10px 25px -5px rgba(34, 211, 238, 0.3)',
      },
    },
  },
  plugins: [],
};