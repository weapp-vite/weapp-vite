export interface PeakRssSamplingStats {
  status: 'available' | 'partial' | 'unavailable'
  completedSampleCount: number
  unavailableSampleCount: number
}

/** 每次采样完成后才安排下一次，停止时只等待已有采样，避免探针自身挤占构建资源。 */
export function createPeakRssSampler(sample: () => Promise<number | null>, intervalMs = 100) {
  let rssPeakBytes: number | null = null
  let completedSampleCount = 0
  let unavailableSampleCount = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> | undefined

  const sampleOnce = async () => {
    let current: number | null
    try {
      current = await sample()
    }
    catch {
      current = null
    }
    completedSampleCount++
    if (current === null || !Number.isFinite(current) || current < 0) {
      unavailableSampleCount++
      return
    }
    rssPeakBytes = Math.max(rssPeakBytes ?? 0, current)
  }

  const start = () => {
    if (stopped || pending) {
      return
    }
    pending = sampleOnce().finally(() => {
      pending = undefined
      if (!stopped) {
        timer = setTimeout(start, intervalMs)
      }
    })
  }
  start()

  return {
    async stop() {
      stopped = true
      clearTimeout(timer)
      await pending
      return {
        rssPeakBytes,
        rssSampling: {
          status: rssPeakBytes === null ? 'unavailable' : unavailableSampleCount ? 'partial' : 'available',
          completedSampleCount,
          unavailableSampleCount,
        } satisfies PeakRssSamplingStats,
      }
    },
  }
}
