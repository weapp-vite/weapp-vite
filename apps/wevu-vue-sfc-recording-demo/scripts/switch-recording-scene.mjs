import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scene = process.argv[2]

const sourceByScene = {
  starter: resolve(__dirname, '../src/pages/index/index.recording-starter.vue'),
  final: resolve(__dirname, '../src/pages/index/index.recording-final.vue'),
  starter90: resolve(__dirname, '../src/pages/index/index.recording-90s-starter.vue'),
  final90: resolve(__dirname, '../src/pages/index/index.recording-90s-final.vue'),
  starter120: resolve(__dirname, '../src/pages/index/index.recording-120s-starter.vue'),
  final120: resolve(__dirname, '../src/pages/index/index.recording-120s-final.vue'),
}

if (!scene || !sourceByScene[scene]) {
  console.error('Usage: pnpm demo:reset | pnpm demo:final | pnpm demo:reset:90s | pnpm demo:final:90s | pnpm demo:reset:120s | pnpm demo:final:120s')
  process.exit(1)
}

const source = sourceByScene[scene]
const target = resolve(__dirname, '../src/pages/index/index.vue')

if (!existsSync(source)) {
  console.error(`[recording-demo] source file not found: ${source}`)
  process.exit(1)
}

copyFileSync(source, target)
console.log(`[recording-demo] switched to ${scene} scene -> src/pages/index/index.vue`)
