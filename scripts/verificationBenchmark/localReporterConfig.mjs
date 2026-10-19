import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 专用采样才追加观察 reporter，保留原有 reporter 与测试执行配置。 */
export function localReporters(original = ['default']) {
  return process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR
    ? [...original, fileURLToPath(new URL('./localReporter.mjs', import.meta.url))]
    : original
}
