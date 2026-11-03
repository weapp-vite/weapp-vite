import type { Arm } from './types'

export const CALIBRATION_POLICY = {
  id: 'common-baseline-50ms-candidate-resolution-v1',
  baselineTargetMs: 50,
  baselineEstimatorFloorMs: 0.01,
  minimumCandidateBatchMs: 0.1,
  maximumIterations: 10000,
} as const

export interface Calibration {
  operation: string
  cohort: string
  iterations: number
  probes: Array<{ arm: Arm, iterations: number, durationMs: number }>
  candidateResolved: boolean | null
}

export function calibrateBatch(run: (arm: Arm, iterations: number) => number | undefined, comparable: boolean): Omit<Calibration, 'operation' | 'cohort'> {
  const probes: Calibration['probes'] = []
  const baseline = run('baseline', 1)
  if (baseline === undefined) {
    return { iterations: 1, probes, candidateResolved: null }
  }
  probes.push({ arm: 'baseline', iterations: 1, durationMs: baseline })
  let iterations = Math.max(1, Math.min(CALIBRATION_POLICY.maximumIterations, Math.ceil(CALIBRATION_POLICY.baselineTargetMs / Math.max(baseline, CALIBRATION_POLICY.baselineEstimatorFloorMs))))
  if (!comparable) {
    return { iterations, probes, candidateResolved: null }
  }
  while (true) {
    const candidate = run('candidate', iterations)
    if (candidate === undefined) {
      return { iterations, probes, candidateResolved: null }
    }
    probes.push({ arm: 'candidate', iterations, durationMs: candidate })
    if (candidate >= CALIBRATION_POLICY.minimumCandidateBatchMs) {
      return { iterations, probes, candidateResolved: true }
    }
    if (iterations === CALIBRATION_POLICY.maximumIterations) {
      return { iterations, probes, candidateResolved: false }
    }
    const growth = candidate > 0 ? Math.ceil(iterations * CALIBRATION_POLICY.minimumCandidateBatchMs / candidate) : iterations * 10
    iterations = Math.min(CALIBRATION_POLICY.maximumIterations, Math.max(iterations + 1, iterations * 2, growth))
  }
}
