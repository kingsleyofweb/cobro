/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        celo: {
          green: "#35D07F",
          yellow: "#FBCC5C",
          dark: "#1E1E1E"
        },
        textile: {
          accent: "#4F46E5",
          purple: "#7C3AED"
        }
      }
    },
  },
  plugins: [],
};
