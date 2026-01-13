import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/types.ts', // Include types.ts for MEAL_TYPE_CONFIG color classes
  ],
  // Safelist meal type colors to ensure they're always included
  safelist: [
    'bg-yellow-100', 'text-yellow-800',   // breakfast
    'bg-orange-100', 'text-orange-800',   // pre_workout
    'bg-teal-100', 'text-teal-800',       // lunch
    'bg-lime-100', 'text-lime-800',       // post_workout
    'bg-purple-100', 'text-purple-800',   // snack
    'bg-blue-100', 'text-blue-800',       // dinner
  ],
  theme: {
    extend: {
      padding: {
        'safe': 'env(safe-area-inset-bottom)',
      },
      animation: {
        rainbow: 'rainbow 2s linear infinite',
      },
      keyframes: {
        rainbow: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [],
}
export default config
