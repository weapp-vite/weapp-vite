import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
  },
}))
