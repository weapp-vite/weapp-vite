import type { Cell, Collection, Measurement, ProfileCase } from './types'
import { assertExactParity, assertMeasurement, cellKey } from './results'

export function createSchedule(cases: readonly ProfileCase[], trials: number, diagnostic: boolean): Cell[] {
  if (!Number.isInteger(trials) || trials < 40) {
    throw new Error('At least 40 alternating pairs per scenario are required.')
  }
  const cells: Cell[] = []
  for (let trial = 0; trial < trials; trial++) {
    for (const fixture of cases) {
      for (const condition of ['cold', 'warm'] as const) {
        for (const sourceMap of [false, true]) {
          for (const arm of trial % 2 ? ['on', 'off'] as const : ['off', 'on'] as const) {
            cells.push({ caseId: fixture.id, trial, arm, condition, sourceMap, metric: 'wall' })
          }
        }
      }
    }
  }
  if (diagnostic) {
    for (const fixture of cases) {
      for (const condition of ['cold', 'warm'] as const) {
        for (const sourceMap of [false, true]) {
          for (const arm of ['off', 'on'] as const) {
            cells.push({ caseId: fixture.id, trial: 0, arm, condition, sourceMap, metric: 'diagnostic' })
          }
        }
      }
    }
  }
  return cells
}

/** 逐样本保存原始结果，任何缺样、语义差异或 worker 失败都保留失败报告。 */
export async function collectCompilerTrials(
  cases: readonly ProfileCase[],
  trials: number,
  diagnostic: boolean,
  collect: (cell: Cell) => Promise<Measurement>,
  checkpoint: (state: Collection) => Promise<void>,
) {
  const schedule = createSchedule(cases, trials, diagnostic)
  const state: Collection = {
    status: 'incomplete',
    expectedWallSamples: schedule.filter(cell => cell.metric === 'wall').length,
    expectedDiagnosticSamples: schedule.filter(cell => cell.metric === 'diagnostic').length,
    samples: [],
    errors: [],
  }
  const seen = new Set<string>()
  const canonical = new Map<string, Measurement>()
  let current: Cell | undefined
  try {
    await checkpoint(state)
    for (const cell of schedule) {
      current = cell
      const sample = await collect(cell)
      state.samples.push(sample)
      await checkpoint(state)
      assertMeasurement(sample, cell)
      const key = cellKey(cell)
      if (seen.has(key)) {
        throw new Error(`Duplicate sample: ${key}`)
      }
      seen.add(key)
      const parityKey = [cell.caseId, cell.sourceMap].join(':')
      const baseline = canonical.get(parityKey)
      if (baseline) {
        assertExactParity(baseline.outcome, sample.outcome, key)
        if (baseline.identity.compilerSha256 !== sample.identity.compilerSha256
          || baseline.identity.sourceSha256 !== sample.identity.sourceSha256) {
          throw new Error(`Compiler or source identity changed: ${key}`)
        }
        // 相同结果复用已核验对象，避免数千样本在父进程重复保留完整 AST/style/map。
        sample.outcome = baseline.outcome
      }
      else {
        canonical.set(parityKey, sample)
      }
      if (cell.metric === 'diagnostic' && cell.arm === 'on') {
        const fixture = cases.find(item => item.id === cell.caseId)!
        const counters = sample.counters
        if (!counters || (fixture.expectCompilerBatch && counters.compilerBatchCalls < 1)
          || (!fixture.expectCompilerBatch && counters.compilerBatchCalls !== 0)
          || counters.compilerBatchRejectedInputs !== 0 || counters.nativeThrownCalls !== 0) {
          throw new Error(`Native batch acceptance/fallback evidence failed: ${key}`)
        }
      }
      current = undefined
    }
    if (seen.size !== state.expectedWallSamples + state.expectedDiagnosticSamples) {
      throw new Error('Sampling collection is incomplete.')
    }
    state.status = 'passed'
  }
  catch (error) {
    state.status = 'failed'
    state.failedCell = current
    state.errors.push(error instanceof Error ? error.stack ?? error.message : String(error))
    throw error
  }
  finally {
    await checkpoint(state)
  }
  return state
}
