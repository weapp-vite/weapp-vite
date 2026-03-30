import process from 'node:process'
import { defineConfig } from 'weapp-vite'

type SharedStrategy = 'duplicate' | 'hoist'

const sharedStrategy = (process.env.WEAPP_CHUNK_STRATEGY as SharedStrategy | undefined) ?? 'duplicate'
const outDir = process.env.WEAPP_CHUNK_OUTDIR ?? 'dist'

export default defineConfig({
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
