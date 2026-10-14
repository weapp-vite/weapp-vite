import type { Checkout } from './collect'
import type { AuditBatch } from './report'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { benchmarkModeSelected } from '../../packages/weapp-vite/scripts/utils/benchmarkSelection'
import { collectShardBatch, collectSide, requestedConfirmationMetrics } from './batch'
import { CollectorStopError } from './collectorStop'
import { policy } from './contract.mjs'
import { runCollector } from './process'
import { hmrProfileCapability } from './profileCapability.mjs'

vi.mock('./process', () => ({ runCollector: vi.fn() }))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it.each(['hmr:classic:weapp-vite-template', 'build'])('selects a template before launching %s and retains its complete lifecycle configuration', async (shard) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shard-selection-'))
  const checkout: Checkout = { id: 'optimized', cwd: root, commit: 'a'.repeat(40), templates: policy.templates.map((t: { id: string }) => ({ id: t.id, root: path.join(root, t.id), packageName: t.id })) }
  try {
    vi.mocked(runCollector).mockImplementation(async (_command, _args, options) => {
      const input = JSON.parse(await readFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'input.json'), 'utf8'))
      expect(input.checkout.templates.map((t: { id: string }) => t.id)).toEqual(['weapp-vite-template'])
      expect(input).not.toHaveProperty('scenarios')
      expect(input.profileCapability).toEqual(shard.startsWith('hmr:') ? hmrProfileCapability(checkout.id, checkout.commit, 'classic') : undefined)
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: [], errors: [], profileCapability: input.profileCapability }))
      return {} as never
    })
    await collectSide(checkout, shard, root, [shard === 'build' ? 'build:weapp-vite-template:first' : 'hmr:classic:weapp-vite-template:native-page-style:repeat:restore'])
    expect(runCollector).toHaveBeenCalledTimes(1)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('filters auto import modes before execution but keeps both edits and restores', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-selection-'))
  try {
    vi.mocked(runCollector).mockImplementation(async (_command, _args, options) => {
      const input = JSON.parse(await readFile(path.join(root, 'input.json'), 'utf8'))
      expect(input.configurations).toEqual(['69:automatic'])
      vi.stubEnv('BENCH_CONFIGURATIONS', JSON.stringify(input.configurations))
      expect(benchmarkModeSelected(1, 'automatic')).toBe(false)
      expect(benchmarkModeSelected(69, 'manual')).toBe(false)
      expect(benchmarkModeSelected(69, 'automatic')).toBe(true)
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: ['first:edit', 'first:restore', 'repeat:edit', 'repeat:restore'].map(phase => ({ id: `auto-hmr:69:automatic:${phase}`, ms: 100 })), errors: [] }))
      return {} as never
    })
    const result = await collectSide({ id: 'optimized', cwd: root, commit: 'a'.repeat(40), templates: [] }, 'auto-hmr', root, ['auto-hmr:69:automatic:repeat:restore'])
    expect(result.values.map(v => v.id)).toEqual(['auto-hmr:69:automatic:repeat:restore'])
    expect(result.errors).toEqual([])
    vi.stubEnv('BENCH_CONFIGURATIONS', '["69:invalid"]')
    expect(() => benchmarkModeSelected(69, 'automatic')).toThrow('Invalid')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects collector capability drift and preserves its patch timeout diagnostic', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'collector-capability-'))
  const checkout: Checkout = { id: 'baseline', cwd: root, commit: policy.baselineSha, templates: [{ id: 'weapp-vite-template', root, packageName: 'weapp-vite-template' }] }
  try {
    vi.mocked(runCollector).mockImplementation(async () => {
      await writeFile(path.join(root, 'values.json'), JSON.stringify({
        values: [{ id: 'hmr:stateful-experimental:weapp-vite-template:app-json:first:edit', ms: 100 }],
        errors: ['Timed out waiting for a stateful HMR patch batch'],
        profileCapability: hmrProfileCapability('optimized', checkout.commit, 'stateful-experimental'),
      }))
      return {} as never
    })
    const result = await collectSide(checkout, 'hmr:stateful-experimental:weapp-vite-template', root)
    expect(result.values).toEqual([])
    expect(result.errors).toEqual(['Timed out waiting for a stateful HMR patch batch', 'Collector HMR profile capability identity mismatch'])
    expect(result.profileCapability).toEqual(hmrProfileCapability('baseline', checkout.commit, 'stateful-experimental'))
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps seven serial alternating build pairs and checkpoints launch failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'paired-order-'))
  const optimized: Checkout = { id: 'optimized', cwd: root, commit: 'a'.repeat(40), templates: [] }
  const checkouts = { optimized, baseline: { ...optimized, id: 'baseline' as const } }
  let active = 0
  try {
    vi.mocked(runCollector).mockImplementation(async (_command, _args, options) => {
      expect(active++).toBe(0)
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: [{ id: 'build:native:first', ms: 100 }], errors: [] }))
      active--
      return {} as never
    })
    const batch = await collectShardBatch(checkouts, 'build', root, 'primary', Date.now() + 10_000)
    expect(batch.samples).toHaveLength(14)
    expect(batch.samples.map(row => `${row.round}:${row.side}`)).toEqual(Array.from({ length: 7 }, (_, round) => (round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']).map(side => `${round}:${side}`)).flat())
    vi.mocked(runCollector).mockRejectedValueOnce(new Error('launch failed'))
    const failed = await collectShardBatch(checkouts, 'build', root, 'confirmation', Date.now() + 10_000)
    expect(failed.errors.join()).toContain('launch failed')
    expect(failed.samples).toHaveLength(1)
    expect(JSON.parse(await readFile(path.join(root, 'confirmation.json'), 'utf8'))).toEqual(failed)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it.each(['cleanup-unconfirmed', 'cancelled'] as const)('checkpoints nonempty samples and stops after %s', async (reason) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'collector-stop-'))
  const optimized: Checkout = { id: 'optimized', cwd: root, commit: 'a'.repeat(40), templates: [] }
  const firstError = new Error(reason === 'cancelled' ? 'Collector interrupted' : 'Collector deadline exceeded')
  const failure = new CollectorStopError(firstError, reason === 'cleanup-unconfirmed' ? { error: new Error('identity unavailable') } : undefined, reason === 'cancelled')
  try {
    vi.mocked(runCollector).mockImplementation(async (_command, _args, options) => {
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: [{ id: 'auto-hmr:69:automatic:first:edit', ms: 100 }], errors: [] }))
      throw failure
    })
    const batch = await collectShardBatch({ optimized, baseline: { ...optimized, id: 'baseline' } }, 'auto-hmr', root, 'primary', Date.now() + 10_000)
    expect(runCollector).toHaveBeenCalledTimes(1)
    expect(batch.samples).toHaveLength(1)
    expect(batch.samples[0]!.values).toHaveLength(1)
    expect(batch).toHaveProperty('stop', failure.stop)
    expect(JSON.parse(await readFile(path.join(root, 'primary.json'), 'utf8')) as unknown).toEqual(batch)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('continues ordinary partial HMR evidence after cleanup has completed', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'partial-hmr-'))
  const optimized: Checkout = { id: 'optimized', cwd: root, commit: 'a'.repeat(40), templates: [] }
  try {
    vi.mocked(runCollector).mockImplementation(async (_command, _args, options) => {
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: [{ id: 'auto-hmr:69:automatic:first:edit', ms: 100 }], errors: ['A separate HMR case failed after complete cleanup'] }))
      throw new Error('Collector failed: exit=1')
    })
    const batch = await collectShardBatch({ optimized, baseline: { ...optimized, id: 'baseline' } }, 'auto-hmr', root, 'primary', Date.now() + 10_000)
    expect(runCollector).toHaveBeenCalledTimes(40)
    expect(batch.samples).toHaveLength(40)
    expect(batch.stop).toBeUndefined()
    expect(batch.errors).toHaveLength(80)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('does not confirm an earlier complete regression after a later collector stop', () => {
  const id = 'auto-hmr:69:automatic:first:edit'
  const primary: AuditBatch = {
    errors: ['ordinary partial HMR failure'],
    samples: Array.from({ length: 20 }, (_, round) => (['baseline', 'optimized'] as const).map(side => ({ round, side, values: [{ id, ms: side === 'baseline' ? 100 : 110, phase: 'first', template: 'auto-import' }] }))).flat(),
  }
  expect(requestedConfirmationMetrics(primary, [id], 'auto-hmr')).toEqual([id])
  primary.stop = { reason: 'cleanup-unconfirmed', resourcesReleased: false, cancelled: false }
  expect(requestedConfirmationMetrics(primary, [id], 'auto-hmr')).toEqual([])
  primary.stop = { reason: 'cancelled', resourcesReleased: true, cancelled: true }
  expect(requestedConfirmationMetrics(primary, [id], 'auto-hmr')).toEqual([])
})
