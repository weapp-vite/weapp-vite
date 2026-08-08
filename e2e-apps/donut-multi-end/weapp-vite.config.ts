import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    vue: {
      enable: false,
    },
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': ['./node_modules/tdesign-miniprogram/miniprogram_dist/*'],
          },
        },
      },
    },
  },
})
