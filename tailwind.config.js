/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./smart_grocery_cart_compare.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#293548',
          850: '#151e2e'
        }
      }
    },
  },
  plugins: [],
}
