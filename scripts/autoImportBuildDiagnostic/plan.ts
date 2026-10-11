import { policy } from '../performanceGate/contract.mjs'

/** 固定原配置和配对数量；独立诊断不写入正式性能结论。 */
export const autoImportBuildDiagnosticPlan = Object.freeze({
  baselineSha: policy.baselineSha as string,
  pairCount: 7,
  configurations: ['69:manual'],
  phases: ['first', 'repeat'] as const,
  performanceGate: 'not-run; opt-in diagnostic timings do not replace original performance acceptance',
})

export function validateAutoImportBuildDiagnosticIdentity(env: Record<string, string | undefined>) {
  if (!/^[a-f0-9]{40}$/.test(env.EXPECTED_CANDIDATE_SHA ?? '') || env.EXPECTED_CANDIDATE_SHA !== env.CANDIDATE_SHA || env.BASELINE_SHA !== autoImportBuildDiagnosticPlan.baselineSha || (env.GITHUB_RUN_ATTEMPT && env.GITHUB_RUN_ATTEMPT !== '1')) {
    throw new Error('Dispatch requires an exact candidate, the original fixed baseline and the first attempt')
  }
}

export function autoImportBuildDiagnosticOrder(round: number) {
  return round % 2 ? ['candidate', 'baseline'] as const : ['baseline', 'candidate'] as const
}
