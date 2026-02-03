import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    lib: {
      root: 'src',
      entry: [
        'components/HelloWorld/HelloWorld.ts',
        'components/sfc-script/index.vue',
        'components/sfc-setup/index.vue',
        'components/sfc-both/index.vue',
      ],
      componentJson: 'auto',
    },
  },
  build: {
    outDir: 'dist-lib',
    minify: false,
  },
})
