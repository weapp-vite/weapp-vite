import type { BindingNative } from '../nativeBindingAnalysis/replay'
import type { ScriptScenario } from '../scriptAnalysisBaseline/types'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 复用现有诊断工具的有界跨平台子进程启动方式。
import { execa } from 'execa'
import { beforeEach, expect, it, vi } from 'vitest'
import { createOptimizedCompilerExecution, OPTIMIZED_COMPILER_VARIANTS } from './execution'

const mocks = vi.hoisted(() => ({
  install: vi.fn(),
  createScript: vi.fn(),
  execute: vi.fn(),
  reset: vi.fn(),
  drained: vi.fn(),
  snapshot: vi.fn(),
  disposeBinding: vi.fn(),
  disposeScript: vi.fn(),
  require: vi.fn(),
  read: vi.fn(),
  native: vi.fn(),
}))
vi.mock('../nativeBindingAnalysis/compileBatch', () => ({ installCompileBatch: mocks.install }))
vi.mock('../scriptAnalysisBaseline/execution', () => ({ createScriptExecution: mocks.createScript }))
vi.mock('node:module', () => ({ createRequire: () => mocks.require }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.read }))

const scenario: ScriptScenario = {
  id: 'composition-smoke',
  kind: 'sfc',
  filename: 'src/components/composition.vue',
  source: '<script setup lang="ts">const props = defineProps<{ title: string }>()</script><template><view>{{ props.title }}</view></template>',
  options: { sourceMap: true },
}
const result = { output: '{"value":{"script":"compiled"}}', inputSha256: 'input-digest', failed: false, warnings: ['warning'], metrics: { astReuse: 1, activeCompiles: 0 } }
const bindingMetrics = { pendingRecords: 0, pendingInputs: 0, activeTemplates: 0, nativeCalls: 0 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.snapshot.mockReturnValue(bindingMetrics)
  mocks.install.mockResolvedValue({ sourceHashes: { binding: 'binding-hash' }, reset: mocks.reset, assertDrained: mocks.drained, snapshot: mocks.snapshot, dispose: mocks.disposeBinding })
  mocks.createScript.mockResolvedValue({ sourceHashes: { script: 'script-hash' }, execute: mocks.execute, dispose: mocks.disposeScript })
  mocks.execute.mockResolvedValue(result)
  mocks.require.mockReturnValue({ analyzeBindingExpressionsNative: mocks.native })
  mocks.native.mockReturnValue([null])
  mocks.read.mockResolvedValue(Buffer.from('native-binary'))
})

it.each(OPTIMIZED_COMPILER_VARIANTS)('installs %s in binding-before-script order with independent metrics and combined identities', async (variant) => {
  const events: string[] = []
  mocks.install.mockImplementation(async () => {
    events.push('binding')
    return { sourceHashes: { binding: 'binding-hash' }, reset: mocks.reset, assertDrained: mocks.drained, snapshot: mocks.snapshot, dispose: mocks.disposeBinding }
  })
  mocks.createScript.mockImplementation(async () => {
    events.push('script')
    return { sourceHashes: variant === 'baseline' ? {} : { script: 'script-hash' }, execute: mocks.execute, dispose: mocks.disposeScript }
  })
  const execution = await createOptimizedCompilerExecution(variant, 'binding.node')
  expect(events).toEqual(variant === 'baseline' ? ['script'] : ['binding', 'script'])
  expect(mocks.createScript).toHaveBeenCalledExactlyOnceWith(variant === 'baseline' ? 'baseline' : variant === 'control' ? 'control' : 'optimized')
  if (variant !== 'baseline') {
    expect(mocks.install.mock.calls[0]![0].mode).toBe(variant === 'optimized-native' ? 'planned-native' : variant === 'optimized-summary' ? 'planned-summary' : 'control-js')
  }
  expect(execution.sourceHashes).toEqual(variant === 'baseline' ? {} : { binding: 'binding-hash', script: 'script-hash' })
  expect(mocks.require).toHaveBeenCalledTimes(variant === 'optimized-native' ? 1 : 0)
  expect(mocks.read).toHaveBeenCalledTimes(variant === 'optimized-native' ? 1 : 0)
  expect(execution.bindingSha256).toBe(variant === 'optimized-native' ? createHash('sha256').update('native-binary').digest('hex') : undefined)
  const invoke = vi.fn()
  expect(await execution.execute(scenario, { invokeSfc: invoke })).toEqual({ ...result, bindingMetrics: variant === 'baseline' ? {} : bindingMetrics })
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(scenario, invoke)
  expect(mocks.reset).toHaveBeenCalledTimes(variant === 'baseline' ? 0 : 1)
  expect(mocks.drained).toHaveBeenCalledTimes(variant === 'baseline' ? 0 : 1)
  mocks.disposeScript.mockImplementation(() => events.push('dispose-script'))
  mocks.disposeBinding.mockImplementation(() => events.push('dispose-binding'))
  execution.dispose()
  execution.dispose()
  expect(events.slice(variant === 'baseline' ? 1 : 2)).toEqual(variant === 'baseline' ? ['dispose-script'] : ['dispose-script', 'dispose-binding'])
})

it('resets bindings before the script execution and snapshots only after drained validation', async () => {
  const events: string[] = []
  mocks.reset.mockImplementation(() => events.push('reset'))
  mocks.execute.mockImplementation(async () => {
    events.push('execute')
    return result
  })
  mocks.drained.mockImplementation(() => events.push('drained'))
  mocks.snapshot.mockImplementation(() => {
    events.push('snapshot')
    return bindingMetrics
  })
  const execution = await createOptimizedCompilerExecution('optimized-summary')
  await execution.execute(scenario)
  expect(events).toEqual(['reset', 'execute', 'drained', 'snapshot'])
  execution.dispose()
})

it('rejects concurrent work and premature disposal without resetting active state', async () => {
  let release: ((value: typeof result) => void) | undefined
  mocks.execute.mockImplementation(() => new Promise(resolve => release = resolve))
  const execution = await createOptimizedCompilerExecution('optimized-js')
  const pending = execution.execute(scenario)
  await expect(execution.execute(scenario)).rejects.toThrow('idle, active owner')
  expect(() => execution.dispose()).toThrow('compile is active')
  expect(mocks.reset).toHaveBeenCalledOnce()
  release?.(result)
  await pending
  execution.dispose()
  await expect(execution.execute(scenario)).rejects.toThrow('idle, active owner')
})

it('cleans up a failed second loader without masking its original error', async () => {
  const original = new Error('script loader failed')
  const cleanup = new Error('cleanup failed')
  mocks.createScript.mockRejectedValue(original)
  mocks.disposeBinding.mockImplementation(() => {
    throw cleanup
  })
  await expect(createOptimizedCompilerExecution('optimized-summary')).rejects.toMatchObject({ cause: original, errors: [original, cleanup] })
  expect(mocks.disposeBinding).toHaveBeenCalledOnce()
  expect(mocks.disposeScript).not.toHaveBeenCalled()
})

it('does not proceed to the script loader after binding installation fails', async () => {
  mocks.install.mockRejectedValue(new Error('binding loader failed'))
  await expect(createOptimizedCompilerExecution('control')).rejects.toThrow('binding loader failed')
  expect(mocks.createScript).not.toHaveBeenCalled()
})

it('rejects source identity conflicts and releases both owners', async () => {
  mocks.createScript.mockResolvedValue({ sourceHashes: { binding: 'different-hash' }, execute: mocks.execute, dispose: mocks.disposeScript })
  await expect(createOptimizedCompilerExecution('control')).rejects.toThrow('source hashes disagree')
  expect(mocks.disposeScript).toHaveBeenCalledOnce()
  expect(mocks.disposeBinding).toHaveBeenCalledOnce()
})

it('retains the setup failure and both secondary cleanup failures', async () => {
  mocks.createScript.mockResolvedValue({ sourceHashes: { binding: 'different-hash' }, execute: mocks.execute, dispose: mocks.disposeScript })
  const cleanup = [new Error('script cleanup'), new Error('binding cleanup')]
  mocks.disposeScript.mockImplementation(() => {
    throw cleanup[0]
  })
  mocks.disposeBinding.mockImplementation(() => {
    throw cleanup[1]
  })
  await expect(createOptimizedCompilerExecution('control')).rejects.toMatchObject({
    cause: new Error('Compiler loader source hashes disagree'),
    errors: [new Error('Compiler loader source hashes disagree'), ...cleanup],
  })
})

it('releases binding ownership even when script cleanup throws, retaining the first error', async () => {
  const original = new Error('script cleanup failed')
  const secondary = new Error('binding cleanup failed')
  mocks.disposeScript.mockImplementation(() => {
    throw original
  })
  mocks.disposeBinding.mockImplementation(() => {
    throw secondary
  })
  const execution = await createOptimizedCompilerExecution('optimized-js')
  expect(() => execution.dispose()).toThrow(expect.objectContaining({ cause: original, errors: [original, secondary] }))
  execution.dispose()
  expect(mocks.disposeScript).toHaveBeenCalledOnce()
  expect(mocks.disposeBinding).toHaveBeenCalledOnce()
})

it('keeps execution failures intact, checks drained state and releases the running guard', async () => {
  const original = new Error('serialization failed')
  const cleanup = new Error('pending template')
  mocks.execute.mockRejectedValueOnce(original)
  mocks.drained.mockImplementationOnce(() => {
    throw cleanup
  })
  const execution = await createOptimizedCompilerExecution('optimized-summary')
  await expect(execution.execute(scenario)).rejects.toMatchObject({ cause: original, errors: [original, cleanup] })
  expect(mocks.drained).toHaveBeenCalledOnce()
  expect(await execution.execute(scenario)).toEqual({ ...result, bindingMetrics })
  execution.dispose()
})

it('rejects unfinished template work rather than publishing a successful result', async () => {
  mocks.drained.mockImplementation(() => {
    throw new Error('Compile batch contains unfinished template work')
  })
  const execution = await createOptimizedCompilerExecution('optimized-summary')
  await expect(execution.execute(scenario)).rejects.toThrow('unfinished template work')
  expect(mocks.snapshot).not.toHaveBeenCalled()
  execution.dispose()
})

it.each(['throw', 'malformed'] as const)('restricts %s injection to one native call and restores the real binding afterward', async (nativeFault) => {
  const execution = await createOptimizedCompilerExecution('optimized-native', 'binding.node')
  const binding = mocks.install.mock.calls[0]![0].binding as BindingNative
  const actual: unknown[] = []
  mocks.execute.mockImplementation(async () => {
    try {
      actual.push(binding.analyzeBindingExpressionsNative([], []))
    }
    catch (error) {
      actual.push((error as Error).message)
    }
    return result
  })
  await execution.execute(scenario, { nativeFault })
  await execution.execute(scenario)
  expect(actual).toEqual([nativeFault === 'throw' ? 'Injected native execution failure' : [], [null]])
  expect(mocks.native).toHaveBeenCalledOnce()
  execution.dispose()
})

it('requires an explicit native binary and rejects unsupported modes and fault ownership', async () => {
  await expect(createOptimizedCompilerExecution('invalid' as never)).rejects.toThrow('Unknown optimized compiler variant')
  for (const path of [undefined, 'binding.cjs']) {
    await expect(createOptimizedCompilerExecution('optimized-native', path)).rejects.toThrow('explicit .node binding path')
  }
  expect(mocks.install).not.toHaveBeenCalled()
  const execution = await createOptimizedCompilerExecution('optimized-js')
  await expect(execution.execute(scenario, { nativeFault: 'throw' })).rejects.toThrow('requires optimized-native')
  expect(mocks.reset).not.toHaveBeenCalled()
  execution.dispose()
})

it('rejects binaries missing the batch entry before installing either compiler loader', async () => {
  mocks.require.mockReturnValue({})
  await expect(createOptimizedCompilerExecution('optimized-native', 'binding.node')).rejects.toThrow('does not expose analyzeBindingExpressionsNative')
  expect(mocks.install).not.toHaveBeenCalled()
  expect(mocks.createScript).not.toHaveBeenCalled()
})

// 真实新进程只验证组合加载、完整输出与生命周期；不采集性能数据。
it('composes both real loaders in fresh serial processes without prematurely caching compiler modules', async () => {
  let expected: unknown
  for (const variant of ['baseline', 'control', 'optimized-js', 'optimized-summary'] as const) {
    const code = `
      import { createOptimizedCompilerExecution } from ${JSON.stringify(new URL('./execution.ts', import.meta.url).href)};
      const execution = await createOptimizedCompilerExecution(${JSON.stringify(variant)});
      try {
        const scenario = ${JSON.stringify(scenario)};
        const first = await execution.execute(scenario);
        const failed = await execution.execute({ ...scenario, source: '<template><view>{{ value + }}</view></template>' });
        const recovered = await execution.execute(scenario);
        process.stdout.write(JSON.stringify({ sourceHashes: execution.sourceHashes, first, failed, recovered }));
      } finally { execution.dispose(); execution.dispose(); }
    `
    const { stdout } = await execa(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', code], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: { NODE_OPTIONS: '', WEAPP_VITE_NATIVE: '0' },
      timeout: 60_000,
    })
    const report = JSON.parse(stdout) as {
      sourceHashes: Record<string, string>
      first: typeof result & { bindingMetrics: Record<string, number> }
      failed: typeof result & { bindingMetrics: Record<string, number> }
      recovered: typeof result & { bindingMetrics: Record<string, number> }
    }
    expect(Object.keys(report.sourceHashes)).toHaveLength(variant === 'baseline' ? 0 : 9)
    expect(report.first.failed).toBe(false)
    expect(report.failed.failed).toBe(true)
    expect(report.recovered.output).toBe(report.first.output)
    expect(report.first.inputSha256).toBe(createHash('sha256').update(JSON.stringify(scenario)).digest('hex'))
    const output: unknown = JSON.parse(report.first.output)
    expect(output).toMatchObject({ value: { script: expect.any(String), template: expect.any(String), scriptMap: expect.any(Object) } })
    expected ??= { output: report.first.output, error: report.failed.output }
    expect({ output: report.first.output, error: report.failed.output }).toEqual(expected)
    for (const sample of [report.first, report.failed, report.recovered]) {
      expect(sample.bindingMetrics.pendingRecords ?? 0).toBe(0)
      expect(sample.bindingMetrics.pendingInputs ?? 0).toBe(0)
      expect(sample.bindingMetrics.activeTemplates ?? 0).toBe(0)
      expect(sample.metrics.activeCompiles ?? 0).toBe(0)
      expect((sample.metrics as Record<string, unknown>).pendingTransfers ?? 0).toBe(0)
    }
    if (variant === 'optimized-summary') {
      expect(report.first.bindingMetrics.queuedRecords).toBeGreaterThan(0)
      expect(report.first.bindingMetrics.baseJsCalls).toBeGreaterThan(0)
    }
  }
}, 180_000)
