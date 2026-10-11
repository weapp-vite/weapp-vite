import type { Fixture, Mode, Pair, Side, SummaryWorker, WorkerResult } from './types'
import { summarizePairs } from '../performanceGate/evaluate'
import { assertEquivalent, validateWorker } from './outcome'
import { PAIRS, sideOrder } from './types'

export type Launch = (mode: Mode, side: Side, fixtures: Fixture[], name: string) => Promise<WorkerResult>
export interface Collection { diagnostics: SummaryWorker[], pairs: Pair[] }

function summarizeWorker(worker: WorkerResult): SummaryWorker {
  return { mode: worker.mode, side: worker.side, samples: worker.samples.map(({ outcome: _outcome, errorStack: _stack, ...sample }) => sample) }
}

/** 先独立核验诊断覆盖，再采固定四十对；完整输出留在私有文件，摘要仅保留结果哈希。 */
export async function collect(fixtures: Fixture[], full: boolean, launch: Launch, checkpoint: (state: Collection) => Promise<void>) {
  const state: Collection = { diagnostics: [], pairs: [] }
  const baseline = await launch('diagnostic', 'off', fixtures, 'diagnostic-off')
  validateWorker(baseline, fixtures)
  state.diagnostics.push(summarizeWorker(baseline))
  await checkpoint(state)
  const check = (worker: WorkerResult, selected = fixtures) => {
    validateWorker(worker, selected)
    for (const sample of worker.samples) {
      assertEquivalent(baseline.samples.find(value => value.id === sample.id)!.outcome, sample.outcome, `${sample.id}/${worker.mode}/${worker.side}`)
    }
    return summarizeWorker(worker)
  }
  state.diagnostics.push(check(await launch('diagnostic', 'on', fixtures, 'diagnostic-on')))
  await checkpoint(state)
  const fallback = fixtures.filter(fixture => fixture.id === 'no-default-export')
  if (fallback.length !== 1) {
    throw new Error('Missing single-script fallback fixture')
  }
  state.diagnostics.push(check(await launch('fault', 'on', fallback, 'diagnostic-fault'), fallback))
  await checkpoint(state)
  if (full) {
    for (let pair = 0; pair < PAIRS; pair++) {
      const order = sideOrder(pair)
      const results: Partial<Record<Side, SummaryWorker>> = {}
      for (const side of order) {
        results[side] = check(await launch('timing', side, fixtures, `pair-${pair}-${side}`))
      }
      state.pairs.push({ pair, order, off: results.off!, on: results.on! })
      await checkpoint(state)
    }
  }
  return state
}

export function timingSummary(state: Collection, fixtures: Fixture[]) {
  return fixtures.map(fixture => ({
    id: fixture.id,
    expectedError: Boolean(fixture.expectError),
    wallMs: summarizePairs(state.pairs.map(pair => ({
      baseline: pair.off.samples.find(sample => sample.id === fixture.id)!.wallMs,
      current: pair.on.samples.find(sample => sample.id === fixture.id)!.wallMs,
    }))),
    rssBytes: summarizePairs(state.pairs.map(pair => ({
      baseline: pair.off.samples.find(sample => sample.id === fixture.id)!.rssBytes,
      current: pair.on.samples.find(sample => sample.id === fixture.id)!.rssBytes,
    }))),
  }))
}
