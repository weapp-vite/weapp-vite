import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
    srcRoot: 'src',
    vue: {
      template: {
        functionPropNames: [/^handler$/],
      },
    },
  },
})
