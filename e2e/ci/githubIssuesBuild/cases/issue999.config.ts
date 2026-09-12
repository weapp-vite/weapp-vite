import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: {
    minify: true,
    outDir: 'dist-issue-999',
  },
  weapp: {
    srcRoot: 'src',
    chunks: {
      dynamicImports: 'native',
    },
  },
})
