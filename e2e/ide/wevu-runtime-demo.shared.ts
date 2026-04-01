import { rm } from 'node:fs/promises'
import path from 'pathe'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

export const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-runtime-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

let sharedBuildPrepared = false

export async function ensureWevuRuntimeDemoBuilt() {
  if (sharedBuildPrepared) {
    return
  }

  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: 'ide:wevu-runtime-demo',
  })
  sharedBuildPrepared = true
}
