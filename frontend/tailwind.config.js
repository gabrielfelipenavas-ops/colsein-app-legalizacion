/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        colsein: { 50: '#E8F4FD', 100: '#BDDDF5', 200: '#8EC5ED', 300: '#5FADE5', 400: '#2F95DD', 500: '#0062A3', 600: '#004A7C', 700: '#003D6B', 800: '#002F53', 900: '#002040' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
