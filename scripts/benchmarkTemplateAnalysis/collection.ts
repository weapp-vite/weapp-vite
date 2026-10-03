import type { AnalysisSample } from './results'
import { summarizeAnalysisSamples } from './results'

type AnalysisCell = Pick<AnalysisSample, 'trial' | 'variant' | 'condition' | 'metric'>

export interface AnalysisCollection {
  status: 'incomplete' | 'passed' | 'failed'
  expectedSamples: number
  samples: AnalysisSample[]
  summary: ReturnType<typeof summarizeAnalysisSamples>
  errors: string[]
  failedSample?: AnalysisCell
}

/** 每个完成样本立即保存；后续 worker 或完整性验证失败仍保留原始数值并明确失败。 */
export async function collectAnalysisTrials(
  trials: number,
  collect: (cell: AnalysisCell) => Promise<Omit<AnalysisSample, 'trial' | 'variant'>>,
  checkpoint: (state: AnalysisCollection) => Promise<void>,
) {
  const state: AnalysisCollection = { status: 'incomplete', expectedSamples: trials * 8, samples: [], summary: [], errors: [] }
  let current: AnalysisCell | undefined
  try {
    await checkpoint(state)
    for (let trial = 0; trial < trials; trial++) {
      const variants = trial % 2 ? ['shared', 'duplicate-control'] as const : ['duplicate-control', 'shared'] as const
      for (const condition of ['cold', 'warm'] as const) {
        for (const metric of ['timing', 'allocation'] as const) {
          for (const variant of variants) {
            current = { trial, variant, condition, metric }
            state.samples.push({ ...await collect(current), variant, trial })
            current = undefined
            await checkpoint(state)
          }
        }
      }
    }
    state.summary = summarizeAnalysisSamples(state.samples)
    state.status = 'passed'
  }
  catch (error) {
    state.status = 'failed'
    state.failedSample = current
    state.errors.push(error instanceof Error ? error.stack ?? error.message : String(error))
    throw error
  }
  finally {
    await checkpoint(state)
  }
  return state
}
