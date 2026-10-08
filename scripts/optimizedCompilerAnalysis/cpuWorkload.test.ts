import type { Profiler } from 'node:inspector'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import type { createOptimizedCompilerExecution } from './execution'
import { describe, expect, it, vi } from 'vitest'
import { collectCompilerCpuWorkload, CPU_SAMPLE_ROUNDS, CPU_WARMUP_ROUNDS } from './cpuWorkload'
import { digest } from './identity'

const scenario: ScriptScenario = {
  kind: 'sfc',
  id: 'sfc-pressure',
  filename: 'src/pages/profile.vue',
  source: '<template><view>profile</view></template>',
  expectError: false,
  expectWarning: false,
  options: {},
}

function fixture() {
  const events: string[] = []
  let sampling = false
  let calls = 0
  const output = () => JSON.stringify({ value: { script: 'compiled', template: '<view>profile</view>' }, warnings: [], consoleWarnings: [] })
  const execution = {
    execute: vi.fn<Awaited<ReturnType<typeof createOptimizedCompilerExecution>>['execute']>(async (input, options) => {
      expect(sampling).toBe(false)
      events.push('input-hash')
      const inputSha256 = digest(JSON.stringify(input))
      const compile = async () => {
        calls++
        events.push('compile')
        return 'compiled'
      }
      await (options?.invokeSfc ? options.invokeSfc(compile) : compile())
      expect(sampling).toBe(false)
      events.push('metrics-and-serialize')
      return { inputSha256, output: output(), warnings: [], failed: false, metrics: {}, bindingMetrics: {} }
    }),
  }
  const profile = (): Profiler.Profile => ({
    startTime: 100,
    endTime: 200,
    nodes: [{ id: 1, callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: -1, columnNumber: -1 } }],
    samples: [1],
    timeDeltas: [100],
  })
  const profiler = {
    async measure<T>(compile: () => Promise<T>) {
      expect(sampling).toBe(false)
      sampling = true
      events.push('start')
      try {
        return { value: await compile(), profile: profile() }
      }
      finally {
        events.push('stop')
        sampling = false
      }
    },
  }
  const saveProfile = vi.fn(async (index: number, recorded: Profiler.Profile) => {
    expect(sampling).toBe(false)
    events.push('save-profile')
    return {
      index,
      file: `profile-${index}.json`,
      sha256: digest(JSON.stringify(recorded)),
      startTime: recorded.startTime,
      endTime: recorded.endTime,
      durationMicroseconds: recorded.endTime - recorded.startTime,
      sampleCount: recorded.samples!.length,
    }
  })
  return { execution, profiler, saveProfile, events, calls: () => calls, output }
}

describe('complete compiler CPU workload', () => {
  it('warms up outside profiling and samples only the compiler callback', async () => {
    const setup = fixture()
    const result = await collectCompilerCpuWorkload(scenario, 'baseline', setup)
    expect(result.failures).toEqual([])
    expect(result.initialOutput).toBe(setup.output())
    expect(result.observations).toHaveLength(1 + CPU_WARMUP_ROUNDS + CPU_SAMPLE_ROUNDS)
    expect(result.observations[0]).toMatchObject({ phase: 'initial', iteration: 0, outputSha256: digest(setup.output()) })
    expect(result.observations.filter(row => row.phase === 'warmup').map(row => row.iteration))
      .toEqual(Array.from({ length: CPU_WARMUP_ROUNDS }, (_, index) => index))
    expect(result.observations.filter(row => row.phase === 'sample').map(row => row.iteration))
      .toEqual(Array.from({ length: CPU_SAMPLE_ROUNDS }, (_, index) => index))
    expect(result.profileArtifacts.map(row => row.index)).toEqual(Array.from({ length: CPU_SAMPLE_ROUNDS }, (_, index) => index))
    expect(setup.calls()).toBe(35)
    expect(setup.saveProfile).toHaveBeenCalledTimes(CPU_SAMPLE_ROUNDS)
    expect(setup.events.slice(0, 3 * 15)).toEqual(Array.from({ length: 15 }, () => ['input-hash', 'compile', 'metrics-and-serialize']).flat())
    expect(setup.events.slice(3 * 15)).toEqual(Array.from({ length: 20 }, () => ['input-hash', 'start', 'compile', 'stop', 'metrics-and-serialize', 'save-profile']).flat())
    expect(JSON.stringify(result)).not.toContain('callFrame')
  })

  it('stops at the first warmup output mismatch and retains both full outputs', async () => {
    const setup = fixture()
    const original = setup.execution.execute.getMockImplementation()!
    setup.execution.execute.mockImplementation(async (...args) => {
      const result = await original(...args)
      return setup.calls() === 2 ? { ...result, output: '{"changedMap":true}' } : result
    })
    const result = await collectCompilerCpuWorkload(scenario, 'baseline', setup)
    expect(result.failures).toHaveLength(1)
    expect(result.observations).toHaveLength(1)
    expect(result.mismatch).toMatchObject({ phase: 'warmup', index: 0, expected: setup.output(), actual: { output: '{"changedMap":true}' } })
    expect(setup.calls()).toBe(2)
    expect(setup.saveProfile).not.toHaveBeenCalled()
  })

  it('preserves original inspector failures even when execution serializes them', async () => {
    const setup = fixture()
    const failure = new AggregateError([new Error('compile failed'), new Error('stop failed')], 'both failed')
    const original = setup.execution.execute.getMockImplementation()!
    setup.profiler.measure = async () => {
      throw failure
    }
    setup.execution.execute.mockImplementation(async (...args) => {
      try {
        return await original(...args)
      }
      catch {
        return { output: '{"error":{"message":"both failed"}}', inputSha256: digest(JSON.stringify(scenario)), warnings: [], failed: true, metrics: {}, bindingMetrics: {} }
      }
    })
    const result = await collectCompilerCpuWorkload(scenario, 'baseline', setup)
    expect(result.failures[0]).toBe(failure)
    expect(result.mismatch).toMatchObject({ phase: 'sample', index: 0, actual: { failed: true } })
    expect(result.observations).toHaveLength(15)
    expect(result.profileArtifacts).toEqual([])
  })

  it('rejects a missing compile callback instead of accepting a zero-profile observation', async () => {
    const setup = fixture()
    const original = setup.execution.execute.getMockImplementation()!
    setup.execution.execute.mockImplementation(input => original(input))
    const result = await collectCompilerCpuWorkload(scenario, 'baseline', setup)
    expect(result.failures).toEqual([expect.objectContaining({ message: 'CPU observation requires exactly one compileVueFile invocation' })])
    expect(result.observations).toHaveLength(15)
    expect(result.profileArtifacts).toEqual([])
  })

  it('retains failed profile persistence and stops before another sample', async () => {
    const setup = fixture()
    const failure = new Error('profile write failed')
    setup.saveProfile.mockRejectedValueOnce(failure)
    const result = await collectCompilerCpuWorkload(scenario, 'baseline', setup)
    expect(result.failures).toEqual([failure])
    expect(setup.calls()).toBe(16)
    expect(result.mismatch).toMatchObject({ phase: 'sample', index: 0, actual: { output: setup.output() } })
  })

  it('rejects native modes without actual batched analysis', async () => {
    const setup = fixture()
    const original = setup.execution.execute.getMockImplementation()!
    setup.execution.execute.mockImplementation(async (...args) => ({
      ...await original(...args),
      metrics: { activeCompiles: 0, pendingTransfers: 0, astAlreadyConsumed: 0 },
      bindingMetrics: { activeTemplates: 0, pendingRecords: 0, pendingInputs: 0, fallbackCount: 0, fallbackReasons: [], nativeCalls: 0 },
    }))
    const result = await collectCompilerCpuWorkload(scenario, 'optimized-native', setup)
    expect(result.failures).toEqual([expect.objectContaining({ message: expect.stringContaining('binding batch was not consumed') })])
    expect(setup.calls()).toBe(1)
  })

  it('does not run non-SFC or expected-error scenarios', async () => {
    const setup = fixture()
    const result = await collectCompilerCpuWorkload({ ...scenario, expectError: true }, 'baseline', setup)
    expect(result.failures).toHaveLength(1)
    expect(setup.execution.execute).not.toHaveBeenCalled()
  })
})
