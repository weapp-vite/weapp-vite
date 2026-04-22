import type { TestJsFormat } from '../utils/jsFormat'
import { rm } from 'node:fs/promises'
import path from 'pathe'
import { runWeappViteBuildWithLogCapture } from '../utils/buildLog'

const CLI_PATH = path.resolve(import.meta.dirname, '../../packages/weapp-vite/bin/weapp-vite.js')

export const APP_ROOT = path.resolve(import.meta.dirname, '../../apps/wevu-runtime-demo')
const DIST_ROOT = path.join(APP_ROOT, 'dist')

const DEFAULT_JS_FORMAT: TestJsFormat = 'esm'
const preparedBuildFormats = new Set<TestJsFormat>()

export async function ensureWevuRuntimeDemoBuilt(jsFormat: TestJsFormat = DEFAULT_JS_FORMAT) {
  if (preparedBuildFormats.has(jsFormat)) {
    return
  }

  await rm(DIST_ROOT, { recursive: true, force: true })
  await runWeappViteBuildWithLogCapture({
    cliPath: CLI_PATH,
    jsFormat,
    projectRoot: APP_ROOT,
    platform: 'weapp',
    cwd: APP_ROOT,
    label: `ide:wevu-runtime-demo:${jsFormat}`,
  })
  preparedBuildFormats.add(jsFormat)
}
