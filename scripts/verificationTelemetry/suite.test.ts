import type { SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { VerificationPlan } from '../../e2e/scripts/verification/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { partitionE2ETasks } from '../../e2e/scripts/e2e-suite-manifest'
import { currentVerificationProfile } from '../../e2e/scripts/verification/profile'
import { resolveVerificationTopology } from '../verification/topology'
import { createBaselineSuitePlan, writeBaselineSuiteTelemetry } from './suite'

const roots: string[] = []
const identity = { runId: 'native-run-attempt-suite', commitSha: 'a'.repeat(40), workingTreeDirty: false }
const tasks = ['ci/first.e2e.test.ts', 'ci/second.test.ts', 'ci/third.integration.test.ts', 'ci/fourth.test.ts'].map(label => ({ label, command: 'pnpm', args: ['vitest', label] }))

function suiteReport(plan: VerificationPlan): SuiteReportPayload {
  return {
    ...identity,
    schemaVersion: 2,
    toolVersion: 1,
    strict: false,
    excludedProjects: [],
    generatedAt: '2026-01-01T00:01:00.000Z',
    jsonFile: '',
    markdownFile: '',
    reportDir: '',
    reportSlug: '',
    suiteName: 'e2e:ci-pr',
    coverage: 'complete',
    acceptance: 'passed',
    execution: { scope: 'full', status: 'passed', profile: plan.profile, executionTopology: plan.executionTopology, assignedTasks: tasks.map(task => task.label), startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z' },
    tasks: plan.tasks.map(task => ({ label: task.label, definitionHash: task.definitionHash, exitCode: 0, status: 'passed', durationMs: 1, artifacts: [] })),
    summary: { taskCount: 4, plannedCount: 4, executedCount: 4, passedCount: 4, failedCount: 0, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: 0, artifactCount: 0 },
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

it('freezes exact legacy shard assignment and preserves original order', async () => {
  const plan = await createBaselineSuitePlan({ suite: 'ci-full', shards: 2, tasks, profile: currentVerificationProfile('ci-full'), identity, sourceDigest: 'b'.repeat(64) })
  for (const index of [0, 1]) {
    expect(plan.tasks.filter(task => task.shardIndex === index + 1).map(task => task.label)).toEqual(partitionE2ETasks(tasks, { index, total: 2 }).map(task => task.label))
  }
})

it('writes actual one-shard and recomputed aggregate without mutating the original report', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-suite-'))
  roots.push(root)
  await fs.mkdir(path.join(root, '.tmp'), { recursive: true })
  await fs.writeFile(path.join(root, '.tmp/build-artifact-manifest.json'), '{"schemaVersion":2}')
  const plan = await createBaselineSuitePlan({ suite: 'ci-pr', shards: 1, tasks, profile: currentVerificationProfile('ci-pr'), identity, sourceDigest: 'b'.repeat(64) })
  const report = suiteReport(plan)
  await writeBaselineSuiteTelemetry(plan, report, 1, tasks.map(task => task.label), root)
  const output = path.join(root, '.tmp/verification-telemetry/suite')
  const read = async (file: string) => JSON.parse(await fs.readFile(path.join(output, file), 'utf8')) as SuiteReportPayload
  expect((await read('shard.json')).execution?.scope).toBe('shard')
  expect((await read('report.json')).execution?.scope).toBe('full')
  expect((await read('report.json')).summary.executedCount).toBe(4)
  expect((await read('shard.json')).execution?.executionTopology).toEqual(plan.executionTopology)
  expect((await read('report.json')).execution?.executionTopology).toEqual(plan.executionTopology)
  expect(report.execution?.scope).toBe('full')
  await expect(writeBaselineSuiteTelemetry(plan, report, 1, tasks.slice(1).map(task => task.label), root)).rejects.toThrow(/assignment/)
  await expect(writeBaselineSuiteTelemetry(plan, { ...report, execution: { ...report.execution!, status: 'failed' } }, 1, tasks.map(task => task.label), root)).rejects.toThrow(/assignment/)
})

it.each([1, 2])('rejects missing, opposite and invalid topology before writing %i-shard formal evidence', async (shards) => {
  const plan = await createBaselineSuitePlan({ suite: 'ci-pr', shards, tasks, profile: currentVerificationProfile('ci-pr'), identity, sourceDigest: 'b'.repeat(64), topology: 'legacy-v1' })
  const assigned = plan.tasks.filter(task => task.shardIndex === 1).map(task => task.label)
  for (const fault of ['missing', 'opposite', 'policy'] as const) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-invalid-topology-'))
    roots.push(root)
    const report = suiteReport(plan)
    report.execution!.executionTopology = fault === 'missing'
      ? undefined
      : fault === 'opposite'
        ? resolveVerificationTopology('optimized-v1')
        : { ...plan.executionTopology, policyDigest: 'f'.repeat(64) }
    const before = structuredClone(report)
    await expect(writeBaselineSuiteTelemetry(plan, report, 1, assigned, root)).rejects.toThrow(/topology/)
    expect(report).toEqual(before)
    expect(await fs.readdir(root)).toEqual([])
  }
})
