import type { AnalysisCollection } from './collection'
import { expect, it } from 'vitest'
import { collectAnalysisTrials } from './collection'

function sample(cell: Parameters<Parameters<typeof collectAnalysisTrials>[1]>[0]) {
  return {
    ...cell,
    outputHash: 'same-output',
    parseCount: cell.variant === 'shared' ? 3 : 6,
    compileMs: 12,
    sampledAllocationBytes: 2048,
    processPeakRssBytes: 8192,
    retainedHeapDeltaBytes: -100,
  }
}

it('checkpoints completed samples and rejects after a later worker failure', async () => {
  const snapshots: AnalysisCollection[] = []
  let calls = 0
  const error = new Error('worker timed out')
  await expect(collectAnalysisTrials(2, async (cell) => {
    if (++calls === 11) {
      throw error
    }
    return sample(cell)
  }, async (state) => { snapshots.push(structuredClone(state)) })).rejects.toBe(error)
  expect(snapshots[0]).toMatchObject({ status: 'incomplete', samples: [], expectedSamples: 16 })
  expect(snapshots.at(-1)).toMatchObject({ status: 'failed', summary: [], failedSample: { trial: 1, variant: 'shared', condition: 'cold', metric: 'allocation' } })
  expect(snapshots.at(-1)!.samples).toHaveLength(10)
  expect(snapshots.at(-1)!.samples[0]!.compileMs).toBe(12)
  expect(snapshots.at(-1)!.errors[0]).toContain('worker timed out')
})

it('retains all raw samples when final output equivalence fails without publishing a success summary', async () => {
  const snapshots: AnalysisCollection[] = []
  await expect(collectAnalysisTrials(1, async cell => ({ ...sample(cell), outputHash: cell.variant }), async (state) => {
    snapshots.push(structuredClone(state))
  })).rejects.toThrow('outputs differ')
  expect(snapshots.at(-1)).toMatchObject({ status: 'failed', summary: [] })
  expect(snapshots.at(-1)!.samples).toHaveLength(8)
})

it('passes only after every paired sample has completed and preserves alternating trial order', async () => {
  const order: string[] = []
  const final = await collectAnalysisTrials(2, async (cell) => {
    order.push(`${cell.trial}:${cell.variant}`)
    return sample(cell)
  }, async () => {})
  expect(final.status).toBe('passed')
  expect(final.samples).toHaveLength(16)
  expect(final.summary).toHaveLength(4)
  expect(order[0]).toBe('0:duplicate-control')
  expect(order[8]).toBe('1:shared')
})
