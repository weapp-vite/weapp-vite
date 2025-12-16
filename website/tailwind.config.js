import { getIconCollections, iconsPlugin } from '@egoist/tailwindcss-icons'
import { themeTransitionPlugin } from 'theme-transition/tailwindcss'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './.vitepress/**/*.{js,ts,vue,md}',
  ],
  darkMode: 'selector',
  theme: {
    extend: {},
  },
  plugins: [
    iconsPlugin({
      collections: getIconCollections(['mdi', 'bi']),
    }),
    themeTransitionPlugin(),
  ],
}
