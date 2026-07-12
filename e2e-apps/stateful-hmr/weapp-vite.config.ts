import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      runtime: 'stateful-experimental',
    },
    srcRoot: 'src',
  },
})
