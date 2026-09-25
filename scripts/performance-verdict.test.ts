import { describe, expect, it } from 'vitest'
import { performanceVerdict } from '../.github/scripts/performanceReport/metrics.mjs'

describe('performance evidence status', () => {
  const report = (statuses: Array<string | undefined>) => ({ errors: [], platforms: statuses.map(status => ({ gate: status ? { status } : undefined })) })
  it('requires all three platform gates, independent of collection success', () => {
    expect(performanceVerdict(report([undefined, undefined, undefined]))).toContain('未完成验收')
    expect(performanceVerdict(report(['passed']))).toContain('未完成验收')
    expect(performanceVerdict(report(['passed', 'passed', 'passed']))).toContain('通过三平台')
  })
  it.each(['unstable', 'incomplete', 'incomparable'])('does not pass %s evidence', (status) => {
    expect(performanceVerdict(report(['passed', status, 'passed']))).toContain('未完成验收')
  })
  it('fails confirmed regression and feature-budget violations', () => {
    expect(performanceVerdict(report(['passed', 'regression', 'passed']))).toContain('未通过')
    expect(performanceVerdict({ ...report(['passed', 'passed', 'passed']), autoImport: { confirmedFailures: ['over budget'] } })).toContain('未通过')
  })
})
