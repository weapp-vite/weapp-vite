import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: false,
    appPrelude: { webRuntime: false },
  },
})
