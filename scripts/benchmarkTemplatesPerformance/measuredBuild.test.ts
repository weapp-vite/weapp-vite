import { performance } from 'node:perf_hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runMeasuredBuild } from './measuredBuild'

const { launch, probe } = vi.hoisted(() => ({ launch: vi.fn(), probe: vi.fn() }))
vi.mock('execa', () => ({ execa: launch }))
vi.mock('./processTreeRss', () => ({ sampleProcessTreeRssBytes: probe }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  launch.mockReset()
  probe.mockReset()
})

describe('measured build lifecycle', () => {
  it('keeps delayed memory cleanup outside process duration and preserves the sample', async () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(120)
    let finish!: (value: { stdout: string, stderr: string }) => void
    let finishProbe!: (value: number | null) => void
    launch.mockReturnValue(Object.assign(new Promise((resolve) => {
      finish = resolve
    }), { pid: 42 }))
    probe.mockImplementation(() => new Promise((resolve) => {
      finishProbe = resolve
    }))
    const result = runMeasuredBuild('node', ['cli.js'], { cwd: '.' })
    await vi.advanceTimersByTimeAsync(20)
    finish({ stdout: 'built in 12ms', stderr: '' })
    await vi.advanceTimersByTimeAsync(1_000)
    finishProbe(256)
    expect(await result).toEqual({
      durationMs: 20,
      cliBuildMs: 12,
      rssPeakBytes: 256,
      rssSampling: { status: 'available', completedSampleCount: 1, unavailableSampleCount: 0 },
    })
    expect(probe).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(launch).toHaveBeenCalledWith('node', ['cli.js'], { cwd: '.', stdin: 'ignore' })
  })

  it('drains the existing probe on failed builds before rejecting with the original error', async () => {
    vi.useFakeTimers()
    const failure = new Error('build failed')
    launch.mockReturnValue(Object.assign(Promise.reject(failure), { pid: 42 }))
    let finishProbe!: (value: number | null) => void
    probe.mockImplementation(() => new Promise((resolve) => {
      finishProbe = resolve
    }))
    const result = runMeasuredBuild('node', ['cli.js'], { cwd: '.' })
    const rejection = expect(result).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(probe).toHaveBeenCalledTimes(1)
    finishProbe(null)
    await rejection
    await vi.advanceTimersByTimeAsync(10_000)
    expect(vi.getTimerCount()).toBe(0)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
