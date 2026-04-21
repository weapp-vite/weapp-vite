import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    srcRoot: 'src',
    platform: 'alipay',
    typescript: {
      app: {
        compilerOptions: {
          types: ['@mini-types/alipay'],
        },
      },
    },
  },
}))
