import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    lib: {
      entry: {
        'components/button/index': 'components/button/index.ts',
        'components/sfc-script/index': 'components/sfc-script/index.vue',
        'components/sfc-setup/index': 'components/sfc-setup/index.vue',
        'components/sfc-both/index': 'components/sfc-both/index.vue',
        'utils/index': 'utils/index.ts',
      },
      root: 'src',
      componentJson: 'auto',
    },
  },
  build: {
    outDir: 'dist',
    minify: false,
  },
})
