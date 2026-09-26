import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: {
    minify: true,
    outDir: 'dist-issue-999',
  },
  weapp: {
    srcRoot: 'src/issue-fixtures/issue-999',
    chunks: {
      dynamicImports: 'native',
    },
  },
})
