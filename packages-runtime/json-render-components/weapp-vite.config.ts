import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'components',
    lib: {
      root: 'components',
      outDir: 'dist/miniprogram',
      entry: ['renderer/index.vue', 'fallback/index.js'],
      preservePath: true,
      componentJson: 'auto',
      dts: false,
    },
  },
  build: { minify: true, rolldownOptions: { external: [/^wevu(?:\/.*)?$/] } },
})
