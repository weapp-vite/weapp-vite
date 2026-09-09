import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    appPrelude: {
      webRuntime: true,
    },
    hmr: {
      logLevel: 'verbose',
    },
    srcRoot: 'src',
  },
})
