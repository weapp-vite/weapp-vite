import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    chunks: {
      sharedStrategy: 'hoist',
      sharedMode: 'common',
      dynamicImports: 'preserve',
    },
    npm: {
      enable: false,
    },
  },
  build: {
    minify: false,
    outDir: 'dist',
  },
})
