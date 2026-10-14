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

  it('captures already buffered streams after duration is fixed and excludes an asynchronous sink', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(30)
    launch.mockReturnValue(Promise.resolve({ stdout: 'built in 12ms', stderr: 'warning' }))
    const sink = Promise.withResolvers<void>()
    const observe = vi.fn(() => sink.promise)
    const result = runMeasuredBuild('node', ['cli.js'], { cwd: '.' }, observe)
    await vi.waitFor(() => expect(observe).toHaveBeenCalledOnce())
    expect(observe).toHaveBeenCalledWith({ status: 'completed', stdout: 'built in 12ms', stderr: 'warning', durationMs: 20 })
    sink.resolve()
    await expect(result).resolves.toMatchObject({ durationMs: 20, cliBuildMs: 12 })
    expect(performance.now).toHaveBeenCalledTimes(2)
  })

  it.each(['success', 'failure'] as const)('does not replace the original %s when saving diagnostic output fails', async (kind) => {
    const failure = Object.assign(new Error('original build failure'), { stdout: 'partial stdout', stderr: 'original error' })
    launch.mockReturnValue(kind === 'success' ? Promise.resolve({ stdout: 'built in 12ms', stderr: '' }) : Promise.reject(failure))
    const observe = vi.fn(async () => {
      throw new Error('diagnostic output failure')
    })
    const result = runMeasuredBuild('node', ['cli.js'], { cwd: '.' }, observe)
    if (kind === 'success') {
      await expect(result).resolves.toMatchObject({ cliBuildMs: 12 })
    }
    else {
      await expect(result).rejects.toBe(failure)
      expect(observe).toHaveBeenCalledWith({ status: 'failed', stdout: failure.stdout, stderr: failure.stderr, errorName: 'Error' })
    }
    expect(observe).toHaveBeenCalledOnce()
  })
})
