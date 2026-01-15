import path from 'node:path'

const __dirname = import.meta.dirname

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
