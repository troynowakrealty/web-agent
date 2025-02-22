/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
      colors: {
        primary: {
          DEFAULT: '#4B9CDB',
          50: '#E8F3FB',
          100: '#D4E7F7',
          200: '#ACCFEF',
          300: '#84B7E7',
          400: '#5C9FDF',
          500: '#4B9CDB',
          600: '#2B7DBD',
          700: '#215F8F',
          800: '#174161',
          900: '#0D2333',
          950: '#081621'
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-scrollbar'),
  ],
}; 