import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
    npm: {
      cache: false,
    },
  },
})
