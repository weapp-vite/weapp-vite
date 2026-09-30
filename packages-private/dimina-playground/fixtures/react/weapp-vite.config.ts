import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: { srcRoot: 'src', autoRoutes: false, react: { renderMode: 'auto', compiler: false } },
  build: { minify: false },
})
