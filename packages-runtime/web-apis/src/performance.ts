import { MINI_PROGRAM_RUNTIME_GLOBAL_KEYS } from '@weapp-core/shared/platforms/runtime/global-keys'
import { resolveGlobalValue } from './globalValue'

const performanceTimeOrigin = Date.now()
const PERFORMANCE_POLYFILL_MARKER = '__weappVitePerformancePolyfill'

function resolveNativePerformance() {
  const candidate = resolveGlobalValue<Performance & Record<string, unknown>>('performance')
  if (
    candidate
    && candidate?.[PERFORMANCE_POLYFILL_MARKER] !== true
    && typeof candidate.now === 'function'
  ) {
    return candidate
  }

  for (const hostKey of MINI_PROGRAM_RUNTIME_GLOBAL_KEYS) {
    const host = (globalThis as Record<string, any>)[hostKey]
    if (!host || typeof host.getPerformance !== 'function') {
      continue
    }

    try {
      const performance = host.getPerformance()
      if (performance && typeof performance.now === 'function') {
        return performance
      }
    }
    catch {
    }
  }

  return undefined
}

const performancePolyfill = {
  [PERFORMANCE_POLYFILL_MARKER]: true,
  now() {
    const nativePerformance = resolveNativePerformance()
    if (nativePerformance && nativePerformance !== performancePolyfill) {
      try {
        return Number(nativePerformance.now())
      }
      catch {
      }
    }

    return Date.now() - performanceTimeOrigin
  },
  timeOrigin: performanceTimeOrigin,
}

export { performancePolyfill }
