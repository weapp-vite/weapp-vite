import { defineConfig } from 'weapp-vite'

export default defineConfig({
  define: {
    __FROM_WEAPP_CONFIG__: JSON.stringify('weapp'),
  },
  build: {
    minify: false,
  },
  weapp: {
    srcRoot: 'src-from-weapp',
    enhance: {
      wxml: false,
    },
    npm: {
      enable: true,
      cache: false,
    },
  },
})
