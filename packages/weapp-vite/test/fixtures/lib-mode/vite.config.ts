import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    lib: {
      entry: [
        'components/button/index.ts',
        'utils/index.ts',
      ],
      root: 'src',
      componentJson: 'auto',
    },
  },
  build: {
    outDir: 'dist',
    minify: false,
  },
})
