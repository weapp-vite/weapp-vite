import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    vue: {
      template: {
        scopedSlotsCompiler: 'augmented',
      },
    },
  },
  build: {
    minify: false,
  },
})
