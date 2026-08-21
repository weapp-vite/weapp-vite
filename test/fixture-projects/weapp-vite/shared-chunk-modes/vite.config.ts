import process from 'node:process'
import { defineConfig } from 'weapp-vite'

const preserveModules = process.env.WEAPP_PRESERVE_MODULES_E2E === 'true'
const outDir = process.env.WEAPP_PRESERVE_MODULES_OUT_DIR
const webOutDir = process.env.WEAPP_PRESERVE_MODULES_WEB_OUT_DIR

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    npm: {
      enable: false,
    },
    web: {
      enable: true,
      root: '.',
      ...(webOutDir ? { outDir: webOutDir } : {}),
    },
    ...(preserveModules
      ? {
          chunks: {
            preserveModules: ['shared/**', 'workers/worker-shared.ts'],
          },
        }
      : {}),
    worker: {
      entry: ['index'],
    },
  },
  build: {
    ...(outDir ? { outDir } : {}),
    minify: false,
  },
})
