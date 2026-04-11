import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(250, 80%, 55%)",
          hover: "hsl(250, 80%, 45%)",
          light: "hsl(250, 80%, 65%)",
          50: "hsl(250, 80%, 95%)",
          100: "hsl(250, 80%, 90%)",
          200: "hsl(250, 80%, 80%)",
          300: "hsl(250, 80%, 70%)",
          400: "hsl(250, 80%, 60%)",
          500: "hsl(250, 80%, 55%)",
          600: "hsl(250, 80%, 45%)",
          700: "hsl(250, 80%, 35%)",
          800: "hsl(250, 80%, 25%)",
          900: "hsl(250, 80%, 15%)",
        },
        success: {
          DEFAULT: "hsl(145, 70%, 40%)",
          light: "hsl(145, 70%, 50%)",
          50: "hsl(145, 70%, 95%)",
        },
        danger: {
          DEFAULT: "hsl(0, 75%, 50%)",
          light: "hsl(0, 75%, 60%)",
          50: "hsl(0, 75%, 95%)",
        },
        warning: {
          DEFAULT: "hsl(40, 90%, 50%)",
          light: "hsl(40, 90%, 60%)",
          50: "hsl(40, 90%, 95%)",
        },
        surface: {
          DEFAULT: "hsl(0, 0%, 100%)",
          dark: "hsl(230, 25%, 14%)",
        },
        background: {
          DEFAULT: "hsl(0, 0%, 98%)",
          dark: "hsl(230, 25%, 10%)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-bounce": "scaleBounce 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleBounce: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "60%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
