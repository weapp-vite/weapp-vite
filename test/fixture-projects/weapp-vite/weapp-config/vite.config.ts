import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src-from-vite',
    enhance: {
      wxs: false,
    },
    npm: {
      enable: false,
    },
  },
})
