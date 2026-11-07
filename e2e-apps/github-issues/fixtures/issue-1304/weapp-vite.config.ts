import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: { srcRoot: 'src', autoRoutes: false, npm: { enable: false }, hmr: { runtime: 'classic' } },
})
