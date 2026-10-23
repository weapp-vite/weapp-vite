import type { VerificationTiming } from '../../e2e/scripts/verification/types'
import { describe, expect, it } from 'vitest'
import { aggregateVerificationReports } from '../../e2e/scripts/verification/aggregate'
import { collectDurationHistory } from '../../e2e/scripts/verification/history'
import { resolveVerificationTopology } from '../verification/topology.ts'
import { useIsolatedTopologyTestEnvironment } from '../verification/topologyTestFixture.ts'
import { freeze, now, profile, receipt, shardReports } from './fixtures'

useIsolatedTopologyTestEnvironment()

function timing(invocationId: string): VerificationTiming {
  return { name: 'machine-lease-acquisition', invocationId, startedAt: now.toISOString(), durationMs: 2, status: 'passed' }
}

describe('complete E2E shard evidence', () => {
  it('retains IDE resource cleanup artifacts while aggregating the frozen task results', async () => {
    const plan = await freeze()
    const reports = shardReports(plan).map(report => ({
      ...report,
      tasks: report.tasks.map(task => ({ ...task, artifacts: [{ kind: 'ide-task-resource-report' as const, indexPath: `docs/reports/resources/${task.label}.json` }] })),
      summary: { ...report.summary, artifactCount: report.tasks.length },
    }))
    const aggregate = await aggregateVerificationReports(plan, reports, { now })
    expect(aggregate.tasks.every(task => task.artifacts[0]?.kind === 'ide-task-resource-report')).toBe(true)
  })

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

  it('reports the rejected task and original reason when strict runtime execution fails', async () => {
    const plan = await freeze({
      suite: 'ide-hmr-headless',
      shards: 1,
      profile: { ...profile, provider: 'headless' },
      readCases: async task => [{ file: `e2e/${task.label}`, name: 'restores the final generation' }],
    })
    const shard = shardReports(plan)[0]!
    const label = shard.tasks[0]!.label
    const report = {
      ...shard,
      acceptance: 'failed',
      execution: { ...shard.execution, status: 'failed' },
      tasks: shard.tasks.map(task => task.label === label
        ? { ...task, status: 'failed', exitCode: 1, reason: 'DOM acceptance did not finish all collected cases successfully' }
        : task),
      summary: { ...shard.summary, passedCount: shard.tasks.length - 1, failedCount: 1 },
    }
    expect(plan.strict).toBe(true)
    const aggregation = aggregateVerificationReports(plan, [report], { now })
    await expect(aggregation).rejects.toThrow('Shard identity, execution status or frozen plan does not match')
    await expect(aggregation).rejects.toThrow('execution.status=failed, coverage=partial, acceptance=failed')
    await expect(aggregation).rejects.toThrow('Task results: passed=3, failed=1')
    await expect(aggregation).rejects.toThrow(`${label}: status=failed, exitCode=1; reason=DOM acceptance did not finish all collected cases successfully`)
  })

  it('preserves every shard root timing and the original per-task timings', async () => {
    const plan = await freeze()
    const shards = shardReports(plan).map((report, index) => ({
      ...report,
      timings: [timing(`lease-${index}`)],
      tasks: report.tasks.map(task => ({ ...task, timings: [timing(`task-${task.label}`)] })),
    }))
    const report = await aggregateVerificationReports(plan, shards, { now })
    expect(report.timings).toEqual(shards.flatMap(shard => shard.timings))
    expect(report.tasks.map(task => task.timings)).toEqual(plan.tasks.map(task => [timing(`task-${task.label}`)]))
  })

  it.each(['root-array', 'task-array', 'root-invalid', 'task-invalid', 'root-duplicate', 'task-duplicate', 'root-task-duplicate'])(
    'rejects %s timing evidence across the entire downloaded report set',
    async (fault) => {
      const plan = await freeze()
      const shards = shardReports(plan).map((report, index) => ({
        ...report,
        timings: [timing(`lease-${index}`)],
        tasks: report.tasks.map(task => ({ ...task, timings: [timing(`task-${task.label}`)] })),
      }))
      const first = shards[0]!
      const second = shards[1]!
      let reports: unknown[] = shards
      if (fault === 'root-array') {
        reports = [{ ...first, timings: {} }, second]
      }
      if (fault === 'task-array') {
        reports = [{ ...first, tasks: first.tasks.map(task => ({ ...task, timings: {} })) }, second]
      }
      if (fault === 'root-invalid') {
        first.timings[0]!.durationMs = Number.NaN
      }
      if (fault === 'task-invalid') {
        first.tasks[0]!.timings[0]!.durationMs = -1
      }
      if (fault === 'root-duplicate') {
        second.timings = structuredClone(first.timings)
      }
      if (fault === 'task-duplicate') {
        second.tasks[0]!.timings = structuredClone(first.tasks[0]!.timings)
      }
      if (fault === 'root-task-duplicate') {
        second.tasks[0]!.timings = structuredClone(first.timings)
      }
      await expect(aggregateVerificationReports(plan, reports, { now })).rejects.toThrow('Invalid E2E timing record')
    },
  )

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

it('preserves the frozen topology and rejects mixed or missing shard topology', async () => {
  const plan = await freeze({ topology: 'legacy-v1' })
  const reports = shardReports(plan)
  expect((await aggregateVerificationReports(plan, reports, { now })).execution?.executionTopology).toEqual(plan.executionTopology)
  reports[0]!.execution.executionTopology = resolveVerificationTopology('optimized-v1')
  await expect(aggregateVerificationReports(plan, reports, { now })).rejects.toThrow('topology mismatch')
  reports[0]!.execution.executionTopology = undefined!
  await expect(aggregateVerificationReports(plan, reports, { now })).rejects.toThrow('Missing or invalid frozen verification topology')
})

it('preserves the resource artifact kind emitted by the actual IDE runner at the strict schema boundary', async () => {
  const plan = await freeze()
  const reports = shardReports(plan)
  const report = reports[0]!
  const artifacts: Array<{ kind: 'ide-task-resource-report', indexPath: string }> = [{ kind: 'ide-task-resource-report', indexPath: 'docs/reports/ide-task-resources/owned-task.json' }]
  const changed = { ...report, tasks: report.tasks.map((task, index) => index === 0 ? { ...task, artifacts } : task), summary: { ...report.summary, artifactCount: 1 } }
  const aggregate = await aggregateVerificationReports(plan, [changed, reports[1]!], { now })
  expect(aggregate.tasks[0]?.artifacts).toEqual(artifacts)
})
