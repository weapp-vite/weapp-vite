import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { target: 'es2019' },
  weapp: { srcRoot: 'src', autoRoutes: false },
})
