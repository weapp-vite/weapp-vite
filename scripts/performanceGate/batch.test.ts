import type { Checkout } from './collect'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { benchmarkModeSelected } from '../../packages/weapp-vite/scripts/utils/benchmarkSelection'
import { collectShardBatch, collectSide } from './batch'
import { policy } from './contract.mjs'
import { runCollector } from './process'

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
      await writeFile(path.join(options.env!.PERFORMANCE_SAMPLE_DIR!, 'values.json'), JSON.stringify({ values: [], errors: [] }))
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
