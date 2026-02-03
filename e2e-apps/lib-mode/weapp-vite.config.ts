import process from 'node:process'
import { defineConfig } from 'weapp-vite/config'

const sharedStrategy = (process.env.WEAPP_CHUNK_STRATEGY as 'duplicate' | 'hoist' | undefined) ?? 'duplicate'
const sharedMode = (process.env.WEAPP_CHUNK_MODE as 'common' | 'path' | 'inline' | undefined) ?? 'common'
const fileName = process.env.WEAPP_LIB_FILE_NAME?.trim() || undefined
const outDir = process.env.WEAPP_LIB_OUTDIR ?? 'dist'

export default defineConfig({
  weapp: {
    lib: {
      entry: {
        'components/button/index': 'components/button/index.ts',
        'components/sfc-script/index': 'components/sfc-script/index.vue',
        'components/sfc-setup/index': 'components/sfc-setup/index.vue',
        'components/sfc-both/index': 'components/sfc-both/index.vue',
        'utils/index': 'utils/index.ts',
      },
      root: 'src',
      componentJson: 'auto',
      fileName,
    },
    chunks: {
      sharedStrategy,
      sharedMode,
      dynamicImports: 'preserve',
    },
  },
  build: {
    outDir,
    minify: false,
  },
})
