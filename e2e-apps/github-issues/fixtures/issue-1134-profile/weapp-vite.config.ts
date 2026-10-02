import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false, emptyOutDir: false },
  weapp: { srcRoot: 'src', autoRoutes: false, hmr: { runtime: 'classic' }, tailwindcss: { cssEntries: ['src/app.css'], rem2rpx: false } },
})
