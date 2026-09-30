import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: { srcRoot: 'runtime', hmr: { runtime: 'classic' } },
  build: { outDir: 'dist', emptyOutDir: false },
})
