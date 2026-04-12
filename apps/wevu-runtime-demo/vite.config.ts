import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    appPrelude: {
      requestRuntime: true,
    },
    srcRoot: 'src',
  },
}))
