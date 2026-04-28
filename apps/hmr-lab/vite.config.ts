import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    hmr: {
      sharedChunks: 'auto',
      logLevel: 'verbose',
      profileJson: true,
    },
  },
})
