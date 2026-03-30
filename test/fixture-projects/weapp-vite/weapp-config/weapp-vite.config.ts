import { defineConfig } from 'weapp-vite/config'

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
