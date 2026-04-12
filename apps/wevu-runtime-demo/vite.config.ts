import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    appPrelude: {
      webRuntime: true,
    },
    srcRoot: 'src',
  },
}))
