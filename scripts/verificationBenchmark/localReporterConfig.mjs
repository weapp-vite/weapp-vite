import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

function ownsCheckout() {
  return Boolean(process.env.WEAPP_VITE_VERIFICATION_LOCAL_DIR
    && process.env.WEAPP_VITE_VERIFICATION_LOCAL_ROOT
    && path.resolve(process.env.WEAPP_VITE_VERIFICATION_LOCAL_ROOT) === path.resolve(fileURLToPath(new URL('../..', import.meta.url))))
}

/** 专用采样才追加观察 reporter，保留原有 reporter。 */
export function localReporters(original = ['default']) {
  return ownsCheckout()
    ? [...original, fileURLToPath(new URL('./localReporter.mjs', import.meta.url))]
    : original
}

/** 完整采样禁止 focus 过滤；普通测试入口维持原配置。 */
export function localTestPolicy() {
  return ownsCheckout() ? { allowOnly: false } : {}
}
