import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '..')
const configFile = resolve(packageRoot, 'analyze-dashboard/vite.config.ts')

async function run() {
  await build({
    configFile,
    root: resolve(packageRoot, 'analyze-dashboard'),
    mode: 'production',
  })
}

run().catch((error) => {
  console.error('[weapp-vite analyze] Failed to build dashboard assets:', error)
  process.exitCode = 1
})
