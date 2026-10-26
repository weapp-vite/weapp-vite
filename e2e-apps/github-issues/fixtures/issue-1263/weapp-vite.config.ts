import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    hmr: { runtime: 'classic' },
    chunks: { sharedMode: 'common' },
  },
  build: {
    minify: false,
  },
})
