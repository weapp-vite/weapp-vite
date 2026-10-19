import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 只增加原 coverage 命令的证据 reporter，不修改覆盖率、阈值、项目、并发或 setup。 */
export function baselineVitestTelemetry(root, env = process.env) {
  if (env.WEAPP_VITE_VERIFICATION_TELEMETRY !== '1' || env.npm_lifecycle_event !== 'test:coverage') {
    return {}
  }
  return {
    reporters: ['default', 'blob', fileURLToPath(new URL('./reporter.mjs', import.meta.url))],
    outputFile: { blob: path.join(root, '.tmp/verification-telemetry/coverage/blob.json') },
  }
}
