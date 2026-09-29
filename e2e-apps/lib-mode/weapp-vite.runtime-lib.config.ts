import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    lib: {
      root: 'src',
      entry: {
        'native/index': 'components/interactive-native/index.ts',
        'vue/index': 'components/interactive-vue/index.vue',
      },
    },
    hmr: { runtime: 'classic' },
  },
  build: { outDir: 'dist/library', minify: true },
})
