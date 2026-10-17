import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: false,
    vue: { enable: false },
    npm: { enable: false },
    mcp: false,
  },
})
