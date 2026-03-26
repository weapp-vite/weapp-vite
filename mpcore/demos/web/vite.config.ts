import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'vue',
  },
  server: {
    host: true,
    port: 4179,
  },
})
