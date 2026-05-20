import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    appPrelude: {
      webRuntime: true,
    },
    srcRoot: 'src',
  },
}))
