import type { SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { VerificationPlan } from '../../e2e/scripts/verification/types'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import * as taskCases from '../../e2e/scripts/domAcceptanceReport/taskCases'
import { partitionE2ETasks } from '../../e2e/scripts/e2e-suite-manifest'
import * as planApi from '../../e2e/scripts/verification/plan'
import { currentVerificationProfile } from '../../e2e/scripts/verification/profile'
import { resolveVerificationTopology } from '../verification/topology'
import { createBaselineSuitePlan, loadBaselineSuitePlan, prepareBaselineSuites, writeBaselineSuiteTelemetry } from './suite'

const roots: string[] = []
const identity = { runId: 'native-run-attempt-suite', commitSha: 'a'.repeat(40), workingTreeDirty: false }
const tasks = ['ci/first.e2e.test.ts', 'ci/second.test.ts', 'ci/third.integration.test.ts', 'ci/fourth.test.ts'].map(label => ({ label, command: 'pnpm', args: ['vitest', label], env: {} }))

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
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

it('forwards the selected topology when resolving the original baseline task inventory', async () => {
  const resolve = vi.spyOn(planApi, 'resolveVerificationTasks').mockResolvedValue(tasks)
  const plan = await createBaselineSuitePlan({ suite: 'ci-pr', topology: 'legacy-v1', shards: 1, profile: currentVerificationProfile('ci-pr'), identity, sourceDigest: 'b'.repeat(64) })
  expect(resolve).toHaveBeenCalledWith('ci-pr', 'legacy-v1')
  expect(plan.executionTopology.id).toBe('legacy-v1')
})

it('prepares both original suites from the supplied native topology environment', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-plan-prepare-'))
  roots.push(root)
  const env = { GITHUB_RUN_ID: '31', GITHUB_RUN_ATTEMPT: '2', WEAPP_VITE_VERIFICATION_TOPOLOGY: 'legacy-v1' }
  vi.spyOn(planApi, 'createVerificationIdentity').mockImplementation(current => ({ ...identity, runId: current!.WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID! }))
  const resolve = vi.spyOn(planApi, 'resolveVerificationTasks').mockResolvedValue(tasks)
  vi.spyOn(taskCases, 'readPlannedTaskCases').mockImplementation(async task => [{ file: `e2e/${task.label}`, name: 'observable case' }])
  await prepareBaselineSuites(root, 'pr', env)
  for (const suite of ['ci-pr', 'ide-dom-headless']) {
    const plan = JSON.parse(await fs.readFile(path.join(root, '.tmp/verification-telemetry/plans', `${suite}.json`), 'utf8')) as VerificationPlan
    expect(plan.executionTopology.id).toBe('legacy-v1')
    expect(plan.runId).toBe(`31-2-${suite}`)
    expect(resolve).toHaveBeenCalledWith(suite, 'legacy-v1')
  }
})

it('loads only the current native attempt, exact checkout and matching execution topology', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-plan-load-'))
  roots.push(root)
  const env = { WEAPP_VITE_VERIFICATION_TELEMETRY: '1', GITHUB_RUN_ID: '31', GITHUB_RUN_ATTEMPT: '2' }
  const plan = await createBaselineSuitePlan({ suite: 'ci-pr', topology: 'legacy-v1', shards: 1, tasks, profile: currentVerificationProfile('ci-pr', env), identity: { ...identity, runId: '31-2-ci-pr' }, sourceDigest: planApi.verificationSourceDigest(tasks) })
  const file = path.join(root, '.tmp/verification-telemetry/plans/ci-pr.json')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(plan))
  const currentIdentity = vi.spyOn(planApi, 'createVerificationIdentity').mockReturnValue(identity)
  expect(await loadBaselineSuitePlan('ci-pr', tasks, { root, env, topology: 'legacy-v1' })).toEqual(plan)
  expect(currentIdentity).toHaveBeenCalledWith(env)
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env: { ...env, GITHUB_RUN_ATTEMPT: '3' }, topology: 'legacy-v1' })).rejects.toThrow('another native run or attempt')
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env: { ...env, GITHUB_RUN_ID: '' }, topology: 'legacy-v1' })).rejects.toThrow('current native run and attempt')
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env: { ...env, WEAPP_VITE_E2E_ACCEPTANCE_RUN_ID: 'another-owner' }, topology: 'legacy-v1' })).rejects.toThrow('another native run or attempt')
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env, topology: 'optimized-v1' })).rejects.toThrow('topology mismatch')
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env, topology: 'legacy-v1', filtered: true })).rejects.toThrow('ad-hoc')
  currentIdentity.mockReturnValue({ ...identity, commitSha: 'c'.repeat(40) })
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env, topology: 'legacy-v1' })).rejects.toThrow('current checkout')
  currentIdentity.mockReturnValue({ ...identity, workingTreeDirty: true })
  await expect(loadBaselineSuitePlan('ci-pr', tasks, { root, env, topology: 'legacy-v1' })).rejects.toThrow('current checkout')
})

it('does not load plans for ordinary or unsupported suites even if no plan files exist', async () => {
  expect(await loadBaselineSuitePlan('ci-pr', tasks, { env: {} })).toBeUndefined()
  expect(await loadBaselineSuitePlan('ide-full:exhaustive', tasks, { env: { WEAPP_VITE_VERIFICATION_TELEMETRY: '1' } })).toBeUndefined()
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
