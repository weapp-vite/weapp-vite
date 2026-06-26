import path from 'node:path'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  weapp: {
    srcRoot: 'src',
    hmr: {
      sharedChunks: 'full',
      logLevel: 'verbose',
      profileJson: true,
    },
    routeRules: {
      'pages/**': {
        layout: 'default',
      },
    },
  },
})
