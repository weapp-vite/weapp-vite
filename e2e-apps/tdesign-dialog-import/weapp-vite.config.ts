import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    typescript: {
      app: {
        compilerOptions: {
          paths: {
            'tdesign-miniprogram/*': [
              './node_modules/tdesign-miniprogram/miniprogram_dist/*',
            ],
          },
        },
      },
    },
  },
})
