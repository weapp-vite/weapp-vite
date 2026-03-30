import { defineConfig } from 'weapp-vite'

export default defineConfig({
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
