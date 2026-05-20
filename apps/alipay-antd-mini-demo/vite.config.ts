import { defineConfig } from 'weapp-vite'

export default defineConfig(() => ({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
