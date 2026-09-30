/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'farm-green': {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        'earth-brown': {
          50: '#faf8f5',
          100: '#f5f0e8',
          200: '#e8dcc7',
          300: '#d4c19f',
          400: '#b89968',
          500: '#a17f4d',
          600: '#8b6d3f',
          700: '#735735',
          800: '#5e4730',
          900: '#4d3a28',
        },
        'sky-blue': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      backgroundImage: {
        'farm-gradient': 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 50%, #86efac 100%)',
        'earth-gradient': 'linear-gradient(135deg, #faf8f5 0%, #e8dcc7 100%)',
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
