import type { VerificationTiming } from '../../e2e/scripts/verification/types'
import { describe, expect, it } from 'vitest'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { collectDurationHistory } from '../../e2e/scripts/verification/history'
import { freeze, now, profile, receipt, shardReports } from './fixtures'

describe('complete E2E shard evidence', () => {
  it('preserves suite acquisition and task diagnostic timings through aggregation', async () => {
    const plan = await freeze()
    const suites: VerificationTiming[] = [0, 1].map(index => ({ name: 'machine-lease-acquisition', invocationId: `lease-${index}`, startedAt: now.toISOString(), durationMs: 2, status: 'passed' }))
    const phase: VerificationTiming = { name: 'fixture-build', invocationId: 'fixture-build', startedAt: now.toISOString(), durationMs: 3, status: 'passed' }
    const reports = shardReports(plan).map((report, index) => ({
      ...report,
      timings: [suites[index]!],
      tasks: report.tasks.map(task => ({ ...task, timings: [{ ...phase, invocationId: `fixture-build-${task.label}` }] })),
    }))
    const report = await aggregateVerificationReports(plan, reports, { now })
    expect(report.timings).toEqual(suites)
    expect(report.tasks.every(task => task.timings?.[0]?.name === 'fixture-build')).toBe(true)
  })

  it('declares completion only after every frozen task passes exactly once', async () => {
    const plan = await freeze()
    const shards = shardReports(plan)
    expect(shards.every(report => report.coverage === 'partial' && report.acceptance === 'incomplete')).toBe(true)
    const report = await aggregateVerificationReports(plan, shards, { now })
    expect(report).toMatchObject({ coverage: 'complete', acceptance: 'passed', execution: { scope: 'full', status: 'passed' }, summary: { taskCount: 4, executedCount: 4 } })
  })

  it.each(['missing', 'duplicate', 'sha', 'run', 'provider', 'plan', 'status', 'schema', 'tool', 'summary', 'definition', 'assignment', 'task'])(
    'rejects %s shard evidence',
    async (fault) => {
      const plan = await freeze()
      const reports = shardReports(plan)
      if (fault === 'missing') {
        reports.pop()
      }
      if (fault === 'duplicate') {
        reports[1] = structuredClone(reports[0]!)
      }
      if (fault === 'sha') {
        reports[0]!.commitSha = 'c'.repeat(40)
      }
      if (fault === 'run') {
        reports[0]!.runId = 'other'
      }
      if (fault === 'provider') {
        reports[0]!.execution.profile = { ...profile, provider: 'headless' }
      }
      if (fault === 'plan') {
        reports[0]!.execution.planHash = 'c'.repeat(64)
      }
      if (fault === 'status') {
        reports[0]!.execution.status = 'failed'
      }
      if (fault === 'schema') {
        reports[0]!.schemaVersion = 1
      }
      if (fault === 'tool') {
        reports[0]!.toolVersion = 2
      }
      if (fault === 'summary') {
        reports[0]!.summary.passedCount++
      }
      if (fault === 'definition') {
        reports[0]!.tasks[0]!.definitionHash = 'c'.repeat(64)
      }
      if (fault === 'assignment') {
        reports[0]!.execution.assignedTasks.pop()
      }
      if (fault === 'task') {
        reports[0]!.tasks[0]!.label = 'unexpected'
      }
      await expect(aggregateVerificationReports(plan, reports, { now })).rejects.toThrow()
    },
  )

  it('uses only recent successful default-branch complete reports with verified provenance', async () => {
    const plan = await freeze()
    const reports = shardReports(plan)
    const full = await aggregateVerificationReports(plan, reports, { now })
    const options = { profile, repository: receipt.repository, workflow: receipt.workflow, now }
    expect(collectDurationHistory([{ receipt, reports }], options).tasks).toEqual({})
    expect(Object.keys(collectDurationHistory([{ receipt, reports: [full] }], options).tasks)).toEqual(['a', 'b', 'c', 'd'])
    expect(() => collectDurationHistory([{ receipt: { ...receipt, verified: false }, reports: [full] }], options)).toThrow()
    expect(() => collectDurationHistory([{ receipt: { ...receipt, headBranch: 'candidate' }, reports: [full] }], options)).toThrow('default-branch')
    expect(() => collectDurationHistory([{ receipt, reports: [full, full] }], options)).toThrow('Duplicate')
    const old = structuredClone(full)
    old.execution!.finishedAt = '2026-09-01T00:00:00.000Z'
    expect(collectDurationHistory([{ receipt, reports: [old] }], options).tasks).toEqual({})
    expect(collectDurationHistory([{ receipt, reports: [{ ...full, toolVersion: 2 }] }], options).tasks).toEqual({})
    expect(collectDurationHistory([{ receipt, reports: [{ ...full, coverage: 'partial' }] }], options).tasks).toEqual({})
    expect(collectDurationHistory([{ receipt, reports: [{ ...full, workingTreeDirty: true }] }], options).tasks).toEqual({})
  })
})
