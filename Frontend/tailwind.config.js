/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a5276',
          50: '#e8f0f7',
          100: '#c5d8ec',
          200: '#9cbce0',
          300: '#73a0d3',
          400: '#4a84c7',
          500: '#2980b9',
          600: '#236fa0',
          700: '#1d5e87',
          800: '#1a5276',
          900: '#14405e',
        },
        accent: '#2980b9',
        success: '#1e8449',
        danger: '#c0392b',
        warning: '#d4ac0d',
        background: '#f0f4f8',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
