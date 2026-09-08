import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
    },
    appPrelude: { webRuntime: true },
    srcRoot: 'src',
  },
})
