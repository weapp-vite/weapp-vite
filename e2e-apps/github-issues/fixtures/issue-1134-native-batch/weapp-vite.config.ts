import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false },
  weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'classic' } },
})
