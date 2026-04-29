import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    jsFormat: 'esm',
    npm: {
      enable: false,
    },
    chunks: {
      sharedStrategy: 'duplicate',
      duplicateWarningBytes: 4 * 1024,
    },
  },
  build: {
    minify: false,
    rolldownOptions: {
      output: {
        minify: false,
      },
    },
  },
})
