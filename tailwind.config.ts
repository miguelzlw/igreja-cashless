import type { Config } from "tailwindcss";

/**
 * Identidade visual "Terra — Organic Design" (inspirada no redesign do Google Stitch).
 * Paleta earthy/desaturada com verde-floresta, marrom-terroso e ocre dourado.
 * Cada tom escolhido foi pensado em conjunto — alterar uma cor isolada quebra
 * a harmonia. Mantemos os nomes "primary/success/danger/warning" que o
 * codebase inteiro já usa pra não exigir refactor de cada componente.
 */
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
        // PRIMARY — verde floresta (substitui a antiga roxa). Toda ação principal.
        primary: {
          DEFAULT: "#4a7c59",
          hover: "#3d6849",
          light: "#78a886",
          50: "#eef5f0",
          100: "#d8f0de",
          200: "#c8e8d0",
          300: "#8ecf9e",
          400: "#78a886",
          500: "#4a7c59",
          600: "#3d6849",
          700: "#2a6038",
          800: "#1e4a2a",
          900: "#0f2d18",
        },
        // TERTIARY — ocre/âmbar terroso. Acentos, badges, destaques secundários.
        tertiary: {
          DEFAULT: "#705c30",
          hover: "#5d4a26",
          light: "#c4a66a",
          50: "#f8f4eb",
          100: "#f8e0a8",
          200: "#dcc48e",
          300: "#c4a66a",
          400: "#9e8347",
          500: "#705c30",
          600: "#5d4a26",
          700: "#554020",
          800: "#3d2e16",
          900: "#221a05",
        },
        // SECONDARY — marrom suave. Textos secundários, bordas, neutros.
        secondary: {
          DEFAULT: "#6b6358",
          hover: "#54493e",
          light: "#d4ccbf",
          50: "#f0e8db",
          100: "#e4e0d8",
          200: "#d4ccbf",
          300: "#a89e8d",
          400: "#85786a",
          500: "#6b6358",
          600: "#54493e",
          700: "#3e362c",
          800: "#2a241c",
          900: "#1e1a13",
        },
        success: {
          DEFAULT: "#3d6849",
          light: "#78a886",
          50: "#eef5f0",
        },
        danger: {
          DEFAULT: "#b83230",
          light: "#d65653",
          50: "#ffdad8",
        },
        warning: {
          DEFAULT: "#9e8347",
          light: "#c4a66a",
          50: "#f8e0a8",
        },
        surface: {
          DEFAULT: "#faf6f0",
          dark: "#1d211f",
        },
        background: {
          DEFAULT: "#faf6f0",
          dark: "#181c1a",
        },
      },
      fontFamily: {
        // sans = body/labels (Nunito Sans — arredondada, amigável)
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        // headline = títulos com personalidade (Literata — serifa quente)
        headline: ["var(--font-literata)", "Georgia", "serif"],
        display: ["var(--font-literata)", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        // Sombra Terra: suave, com tom marrom-esverdeado em vez de preto puro.
        terra: "0 4px 20px rgba(46, 50, 48, 0.06)",
        "terra-lg": "0 8px 30px rgba(46, 50, 48, 0.08)",
        "terra-glow": "0 4px 24px rgba(74, 124, 89, 0.18)",
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
        "sway": "sway 4s ease-in-out infinite",
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
        // Animação sutil pras bandeirinhas no header (junino sem ser cafona)
        sway: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
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
