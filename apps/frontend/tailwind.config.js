/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agro: {
          50: '#f2f9f1',
          100: '#e1f2df',
          200: '#c5e5c2',
          500: '#3b8a3e',
          600: '#2d6e30',
          700: '#245626',
          800: '#1d451f',
          900: '#143315',
        },
      },
    },
  },
  plugins: [],
}
