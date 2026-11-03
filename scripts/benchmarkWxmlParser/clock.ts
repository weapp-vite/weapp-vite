export interface ClockInformation {
  source: 'performance.now'
  reads: number
  positiveChanges: number
  minimumPositiveDeltaMs: number | null
  maximumPositiveDeltaMs: number | null
  timeOrigin: number
  crossOriginIsolated: boolean | null
  secureContext: boolean | null
}

export function probeClock(reads = 10000): ClockInformation {
  let previous = performance.now()
  let minimum = Number.POSITIVE_INFINITY
  let maximum = 0
  let positiveChanges = 0
  for (let index = 0; index < reads; index++) {
    const current = performance.now()
    const delta = current - previous
    if (delta > 0) {
      minimum = Math.min(minimum, delta)
      maximum = Math.max(maximum, delta)
      positiveChanges++
    }
    previous = current
  }
  const isolated = Reflect.get(globalThis, 'crossOriginIsolated')
  const secure = Reflect.get(globalThis, 'isSecureContext')
  return {
    source: 'performance.now',
    reads,
    positiveChanges,
    minimumPositiveDeltaMs: positiveChanges ? minimum : null,
    maximumPositiveDeltaMs: positiveChanges ? maximum : null,
    timeOrigin: performance.timeOrigin,
    crossOriginIsolated: typeof isolated === 'boolean' ? isolated : null,
    secureContext: typeof secure === 'boolean' ? secure : null,
  }
}
