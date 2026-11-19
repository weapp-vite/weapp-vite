import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { updateAutoImportComponents } from './autoImportComponents/index'

const outputDir = fileURLToPath(new URL('../packages/weapp-vite/src/auto-import-components/resolvers/json', import.meta.url))

updateAutoImportComponents({ outputDir }).catch((error: unknown) => {
  console.error('[component-resolvers] generation failed')
  console.error(error)
  process.exitCode = 1
})
