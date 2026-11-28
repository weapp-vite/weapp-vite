import { shouldInstallWebRuntimeGlobal } from './globalValue'

/** 没有额外能力修补规则的目标只区分缺失/占位与真实宿主实现。 */
export function ensureWebRuntimeGlobal(current: unknown, fallback: unknown) {
  return shouldInstallWebRuntimeGlobal(current) ? fallback : current
}

export function ensureWebRuntimePerformance(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current) || !current || typeof (current as { now?: unknown }).now !== 'function') {
    return fallback
  }
  return current
}

export function ensureWebRuntimeCrypto(current: unknown, fallback: unknown) {
  if (shouldInstallWebRuntimeGlobal(current) || !current || typeof (current as { getRandomValues?: unknown }).getRandomValues !== 'function') {
    return fallback
  }
  return current
}
