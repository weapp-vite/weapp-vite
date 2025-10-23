import path from 'node:path'

/**
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    path.resolve(__dirname, './pages/**/*.{wxml,js,ts,jsx,tsx}'),
  ],
  corePlugins: {
    preflight: false,
  },
}
