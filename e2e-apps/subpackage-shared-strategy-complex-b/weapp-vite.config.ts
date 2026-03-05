import process from 'node:process'
import { defineConfig } from 'weapp-vite/config'

type SharedStrategy = 'duplicate' | 'hoist'

const sharedStrategy = (process.env.WEAPP_CHUNK_STRATEGY as SharedStrategy | undefined) ?? 'duplicate'
const outDir = process.env.WEAPP_CHUNK_OUTDIR ?? 'dist'

export default defineConfig({
  define: {
    __VITE_IS_MODERN__: false,
  },
  weapp: {
    srcRoot: 'src',
    chunks: {
      sharedStrategy,
      sharedMode: 'common',
      dynamicImports: 'preserve',
    },
    npm: {
      enable: false,
    },
  },
  build: {
    outDir,
    minify: false,
  },
})
