import path from 'node:path'
import { WeappTailwindcss } from 'weapp-tailwindcss/vite'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  plugins: [
    WeappTailwindcss({
      cssEntries: [
        path.resolve(import.meta.dirname, 'tailwind.css'),
        path.resolve(import.meta.dirname, 'sub-normal/pages/index.css'),
        path.resolve(import.meta.dirname, 'sub-independent/pages/index.css'),
      ],
    }),
  ],
})
