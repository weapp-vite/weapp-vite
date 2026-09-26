import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPeakRssSampler } from './peakRssSampler'

afterEach(() => vi.useRealTimers())

describe('peak RSS sampler lifecycle', () => {
  it('never overlaps slow samples and waits for the pending sample when stopped', async () => {
    vi.useFakeTimers()
    let active = 0
    let maximumActive = 0
    const sample = vi.fn(async () => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, 2_000))
      active--
      return 256
    })
    const sampler = createPeakRssSampler(sample)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sample).toHaveBeenCalledTimes(1)
    let stopped = false
    const stopping = sampler.stop().then((result) => {
      stopped = true
      return result
    })
    expect(stopped).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect((await stopping).rssPeakBytes).toBe(256)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(maximumActive).toBe(1)
    expect(active).toBe(0)
    expect(sample).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the scheduled sample without starting a final probe', async () => {
    vi.useFakeTimers()
    const sample = vi.fn(async () => 512)
    const sampler = createPeakRssSampler(sample)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)
    const first = await sampler.stop()
    expect(await sampler.stop()).toEqual(first)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sample).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves unavailable samples without inventing RSS values', async () => {
    vi.useFakeTimers()
    const sample = vi.fn<() => Promise<number | null>>()
      .mockRejectedValueOnce(new Error('probe unavailable'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(128)
    const sampler = createPeakRssSampler(sample)
    await vi.advanceTimersByTimeAsync(200)
    expect(await sampler.stop()).toEqual({
      rssPeakBytes: 128,
      rssSampling: { status: 'partial', completedSampleCount: 3, unavailableSampleCount: 2 },
    })
    const unavailable = createPeakRssSampler(async () => null)
    expect(await unavailable.stop()).toEqual({
      rssPeakBytes: null,
      rssSampling: { status: 'unavailable', completedSampleCount: 1, unavailableSampleCount: 1 },
    })
  })
})
