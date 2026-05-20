import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    hmr: {
      logLevel: 'verbose',
      profileJson: true,
    },
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
