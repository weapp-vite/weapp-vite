import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      enable: false,
    },
    web: {
      enable: true,
      root: '.',
    },
    worker: {
      entry: ['index'],
    },
  },
  build: {
    minify: false,
  },
})
