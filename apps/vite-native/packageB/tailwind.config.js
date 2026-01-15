import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
