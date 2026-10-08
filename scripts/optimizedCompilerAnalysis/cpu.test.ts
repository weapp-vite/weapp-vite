import type { Profiler } from 'node:inspector'
import type { CompilerCpuSession } from './cpu'
import { describe, expect, it, vi } from 'vitest'
import { summarizeCpuProfile } from '../astMigrationProfile/cpuSummary'
import { createCompilerCpuProfiler, mergeCpuProfiles } from './cpu'

function node(id: number, name: string, children?: number[]): Profiler.ProfileNode {
  return {
    id,
    callFrame: { functionName: name, scriptId: 'fixture', url: '', lineNumber: -1, columnNumber: -1 },
    ...(children === undefined ? {} : { children }),
  }
}

function profile(): Profiler.Profile {
  return { nodes: [node(20, '(root)', [30, 40]), node(30, 'compile'), node(40, '(garbage collector)')], samples: [30, 30, 40], timeDeltas: [10, 10, 10], startTime: 100, endTime: 150 }
}

function session() {
  const result = profile()
  const instance = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    post: vi.fn<CompilerCpuSession['post']>(async method => method === 'Profiler.stop' ? { profile: result } : {}),
  }
  return { instance, result }
}

describe('compiler CPU sampling lifecycle', () => {
  it('samples only sequential compile calls and disposes once', async () => {
    const { instance, result } = session()
    const sampler = await createCompilerCpuProfiler(() => instance)
    expect(instance.connect).toHaveBeenCalledOnce()
    expect(instance.post.mock.calls).toEqual([['Profiler.enable'], ['Profiler.setSamplingInterval', { interval: 1000 }]])
    const value = { compiled: true }
    const compile = vi.fn(async () => {
      expect(instance.post.mock.lastCall).toEqual(['Profiler.start'])
      return value
    })
    expect(await sampler.measure(compile)).toEqual({ value, profile: result })
    expect(await sampler.measure(async () => 2)).toMatchObject({ value: 2 })
    expect(instance.post.mock.calls.slice(2)).toEqual([['Profiler.start'], ['Profiler.stop'], ['Profiler.start'], ['Profiler.stop']])
    await Promise.all([sampler.dispose(), sampler.dispose()])
    expect(instance.post.mock.lastCall).toEqual(['Profiler.disable'])
    expect(instance.disconnect).toHaveBeenCalledOnce()
    await expect(sampler.measure(compile)).rejects.toThrow('disposed')
  })

  it('rejects overlapping measurements and disposal until compile settles', async () => {
    const { instance } = session()
    const sampler = await createCompilerCpuProfiler(() => instance)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const measured = sampler.measure(() => gate)
    const second = vi.fn(async () => undefined)
    await expect(sampler.measure(second)).rejects.toThrow('sampling')
    await expect(sampler.dispose()).rejects.toThrow('sampling')
    expect(second).not.toHaveBeenCalled()
    release()
    await measured
    await sampler.dispose()
  })

  it.each([new Error('compile failed'), undefined, null])('stops after a thrown compile value and remains reusable: %s', async (error) => {
    const { instance } = session()
    const sampler = await createCompilerCpuProfiler(() => instance)
    await expect(sampler.measure(async () => {
      throw error
    })).rejects.toBe(error)
    expect(instance.post.mock.lastCall).toEqual(['Profiler.stop'])
    expect(await sampler.measure(async () => 'recovered')).toMatchObject({ value: 'recovered' })
    await sampler.dispose()
  })

  it('retains both compile and stop failures and forbids sampling a damaged session', async () => {
    const { instance } = session()
    const compileError = new Error('compile failed')
    const stopError = new Error('stop failed')
    const sampler = await createCompilerCpuProfiler(() => instance)
    instance.post.mockImplementation(async (method) => {
      if (method === 'Profiler.stop') {
        throw stopError
      }
      return {}
    })
    await expect(sampler.measure(async () => {
      throw compileError
    })).rejects.toMatchObject({ errors: [compileError, stopError] })
    await expect(sampler.measure(async () => 1)).rejects.toThrow('failed')
    await sampler.dispose()
    expect(instance.disconnect).toHaveBeenCalledOnce()
  })

  it.each(['Profiler.start', 'Profiler.stop'] as const)('does not swallow %s failures', async (failedMethod) => {
    const { instance } = session()
    const error = new Error(failedMethod)
    const sampler = await createCompilerCpuProfiler(() => instance)
    instance.post.mockImplementation(async (method) => {
      if (method === failedMethod) {
        throw error
      }
      return {}
    })
    const compile = vi.fn(async () => 1)
    await expect(sampler.measure(compile)).rejects.toBe(error)
    expect(compile).toHaveBeenCalledTimes(failedMethod === 'Profiler.start' ? 0 : 1)
    await expect(sampler.measure(compile)).rejects.toThrow('failed')
    await sampler.dispose()
  })

  it('cleans up failed setup without losing the setup error', async () => {
    const { instance } = session()
    const setupError = new Error('interval failed')
    const disconnectError = new Error('disconnect failed')
    instance.post.mockRejectedValueOnce(setupError)
    instance.disconnect.mockImplementation(() => {
      throw disconnectError
    })
    await expect(createCompilerCpuProfiler(() => instance)).rejects.toMatchObject({ errors: [setupError, disconnectError] })
    expect(instance.disconnect).toHaveBeenCalledOnce()
  })

  it('disconnects after disable errors and reports both cleanup failures once', async () => {
    const { instance } = session()
    const sampler = await createCompilerCpuProfiler(() => instance)
    const disableError = new Error('disable failed')
    const disconnectError = new Error('disconnect failed')
    instance.post.mockRejectedValueOnce(disableError)
    instance.disconnect.mockImplementation(() => {
      throw disconnectError
    })
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(sampler.dispose()).rejects.toMatchObject({ errors: [disableError, disconnectError] })
    }
    expect(instance.disconnect).toHaveBeenCalledOnce()
  })
})

describe('counts-only CPU profile aggregation', () => {
  it('retains separate trees, frames, duplicated functions and GC with no fabricated timeline', () => {
    const first = profile()
    first.nodes[1]!.positionTicks = [{ line: 3, ticks: 2 }]
    const second = profile()
    second.nodes.reverse()
    second.startTime = 10_000
    second.endTime = 10_040
    second.samples = [30, 40]
    second.timeDeltas = [15, 20]
    const original = structuredClone([first, second])
    const merged = mergeCpuProfiles([first, second])
    expect(merged).toMatchObject({ aggregateKind: 'counts-only', sourceProfileCount: 2, startTime: 0, endTime: 0 })
    expect(merged).not.toHaveProperty('timeDeltas')
    expect(new Set(merged.nodes.map(entry => entry.id)).size).toBe(7)
    expect(merged.nodes[0]!.children).toHaveLength(2)
    expect(merged.samples!.map(id => merged.nodes.find(entry => entry.id === id)!.callFrame.functionName))
      .toEqual(['compile', 'compile', '(garbage collector)', 'compile', '(garbage collector)'])
    const summary = summarizeCpuProfile(merged, '/repo')
    expect(summary.totalSamples).toBe(5)
    expect(summary.topFunctions.find(entry => entry.functionName === 'compile')).toMatchObject({ selfSamples: 3, inclusiveSamples: 3 })
    expect(summary.modules.find(entry => entry.category === 'gc')).toMatchObject({ selfSamples: 2, inclusiveSamples: 2 })
    expect(summary.modules.find(entry => entry.category === 'root')).toMatchObject({ inclusiveSamples: 5 })
    expect([first, second]).toEqual(original)
    merged.nodes.find(entry => entry.positionTicks)!.positionTicks![0]!.ticks = 100
    expect(first.nodes[1]!.positionTicks![0]!.ticks).toBe(2)
  })

  it('keeps individually empty windows but requires an aggregate with actual samples', () => {
    const empty = profile()
    empty.samples = []
    expect(mergeCpuProfiles([empty, profile()]).samples).toHaveLength(3)
    expect(() => mergeCpuProfiles([empty])).toThrow('no samples')
    expect(() => mergeCpuProfiles([])).toThrow('at least one')
  })

  it.each([
    ['duplicate id', (input: Profiler.Profile) => { input.nodes[1]!.id = 20 }],
    ['dangling child', (input: Profiler.Profile) => { input.nodes[0]!.children!.push(50) }],
    ['duplicate child', (input: Profiler.Profile) => { input.nodes[0]!.children!.push(30) }],
    ['dangling sample', (input: Profiler.Profile) => { input.samples!.push(50) }],
    ['multiple roots', (input: Profiler.Profile) => { input.nodes.push(node(50, 'other')) }],
    ['disconnected cycle', (input: Profiler.Profile) => { input.nodes.push(node(50, 'a', [60]), node(60, 'b', [50])) }],
    ['shared child', (input: Profiler.Profile) => { input.nodes[1]!.children = [40] }],
    ['invalid frame', (input: Profiler.Profile) => { input.nodes[1]!.callFrame.lineNumber = -2 }],
    ['invalid interval', (input: Profiler.Profile) => { input.endTime = 1 }],
  ] as const)('rejects %s explicitly', (_name, mutate) => {
    const input = profile()
    mutate(input)
    expect(() => mergeCpuProfiles([input])).toThrow('CPU profile')
  })
})
