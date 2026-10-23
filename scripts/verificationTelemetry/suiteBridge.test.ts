import type { SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { SuiteTask } from '../../e2e/scripts/suiteRunner'
import type { VerificationPlan } from '../../e2e/scripts/verification/types'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as taskCases from '../../e2e/scripts/domAcceptanceReport/taskCases'
import { getSuiteTasks, partitionE2ETasks } from '../../e2e/scripts/e2e-suite-manifest'
import { runE2ESuiteCli } from '../../e2e/scripts/run-e2e-suite'
import { runTaskSuite } from '../../e2e/scripts/suiteRunner'
import { currentVerificationProfile } from '../../e2e/scripts/verification/profile'
import { createBaselineSuitePlan, loadBaselineSuitePlan, writeBaselineSuiteTelemetry } from './suite'

vi.mock('../../e2e/scripts/suiteRunner', () => ({
  isDevtoolsVitestTask: () => false,
  runTaskSuite: vi.fn(),
}))
vi.mock('../../e2e/scripts/e2e-suite-manifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../e2e/scripts/e2e-suite-manifest')>()
  return { ...actual, getSuiteTasks: vi.fn() }
})
vi.mock('./suite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./suite')>()
  return { ...actual, loadBaselineSuitePlan: vi.fn(), writeBaselineSuiteTelemetry: vi.fn() }
})

const tasks = ['first', 'second', 'third', 'fourth'].map(name => ({ label: `ci/${name}.test.ts`, command: 'fake-child', args: [] as string[], env: {} }))
let plan: VerificationPlan
let events: string[]

function reportFor(selected: SuiteTask[], status: NonNullable<SuiteReportPayload['execution']>['status'] = 'passed'): SuiteReportPayload {
  return {
    ...plan,
    schemaVersion: 2,
    strict: plan.strict,
    suiteName: `e2e:${plan.suite}`,
    excludedProjects: [],
    generatedAt: new Date().toISOString(),
    jsonFile: '',
    markdownFile: '',
    reportDir: '',
    reportSlug: '',
    coverage: 'complete',
    acceptance: 'passed',
    execution: { scope: 'full', status, profile: plan.profile, executionTopology: plan.executionTopology, assignedTasks: selected.map(task => task.label), startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z' },
    tasks: [],
    summary: { artifactCount: 0, failedCount: 0, passedCount: selected.length, taskCount: selected.length, plannedCount: selected.length, executedCount: selected.length, blockedCount: 0, skippedCount: 0, notExecutedCount: 0, outOfScopeCount: 0 },
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  for (const name of ['WEAPP_VITE_E2E_TASK_FILTER', 'WEAPP_VITE_E2E_TASK_FROM', 'WEAPP_VITE_E2E_TASK_ROLL_FROM', 'WEAPP_VITE_E2E_SHARD_INDEX', 'WEAPP_VITE_E2E_SHARD_TOTAL', 'WEAPP_VITE_E2E_TEMPLATE', 'WEAPP_VITE_E2E_EXCLUDE_PROJECTS', 'WEAPP_VITE_VERIFICATION_TOPOLOGY', 'WEAPP_VITE_VERIFICATION_TOPOLOGY_POLICY']) {
    vi.stubEnv(name, undefined)
  }
  vi.stubEnv('WEAPP_VITE_VERIFICATION_TELEMETRY', '1')
  vi.mocked(getSuiteTasks).mockImplementation(async () => structuredClone(tasks))
  plan = await createBaselineSuitePlan({ suite: 'ci-pr', topology: 'legacy-v1', shards: 1, tasks, profile: currentVerificationProfile('ci-pr'), identity: { runId: 'native-attempt-ci-pr', commitSha: 'a'.repeat(40), workingTreeDirty: false }, sourceDigest: 'b'.repeat(64) })
  vi.mocked(loadBaselineSuitePlan).mockImplementation(async (_suite, _tasks, options) => {
    if (options?.filtered) {
      throw new Error('Formal baseline telemetry cannot record an ad-hoc suite selection')
    }
    return plan
  })
  events = []
  vi.mocked(runTaskSuite).mockImplementation(async (_name, selected, options) => {
    events.push('execute')
    options?.onReport?.(reportFor(selected))
    events.push('runner-cleanup-and-release')
    return 0
  })
  vi.mocked(writeBaselineSuiteTelemetry).mockImplementation(async () => {
    events.push('telemetry')
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.exitCode = 0
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('retains ordinary defaults and original report callback without loading a baseline plan', async () => {
  vi.stubEnv('WEAPP_VITE_VERIFICATION_TELEMETRY', undefined)
  const onReport = vi.fn()
  expect(await runE2ESuiteCli(['ci-pr'], { onReport })).toBe(0)
  expect(loadBaselineSuitePlan).not.toHaveBeenCalled()
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
  expect(vi.mocked(runTaskSuite).mock.calls[0]![2]?.onReport).toBe(onReport)
  expect(onReport).toHaveBeenCalledOnce()
})

it('loads the full plan before fake children and awaits evidence only after original cleanup and callback', async () => {
  const onReport = vi.fn((_report: SuiteReportPayload) => {
    events.push('original-report')
  })
  const beforeTaskLaunch = vi.fn()
  expect(await runE2ESuiteCli(['ci-pr', '--topology=legacy-v1'], { onReport, beforeTaskLaunch })).toBe(0)
  expect(loadBaselineSuitePlan).toHaveBeenCalledWith('ci-pr', tasks, expect.objectContaining({ topology: 'legacy-v1', filtered: false }))
  const [, selected, options] = vi.mocked(runTaskSuite).mock.calls[0]!
  expect(selected).toEqual(tasks)
  expect(options?.beforeTaskLaunch).toBe(beforeTaskLaunch)
  expect(beforeTaskLaunch).not.toHaveBeenCalled()
  expect(options?.reportContext).toMatchObject({ runId: plan.runId, commitSha: plan.commitSha, workingTreeDirty: false, strict: false, partial: false, executionTopology: plan.executionTopology })
  expect(events).toEqual(['execute', 'original-report', 'runner-cleanup-and-release', 'telemetry'])
  expect(writeBaselineSuiteTelemetry).toHaveBeenCalledWith(plan, onReport.mock.calls[0]![0], 1, tasks.map(task => task.label))
})

it('keeps original full-suite partition order and checks the exact frozen assignment', async () => {
  plan = await createBaselineSuitePlan({ suite: 'ci-full', topology: 'legacy-v1', shards: 2, tasks, profile: currentVerificationProfile('ci-full'), identity: { runId: 'native-attempt-ci-full', commitSha: 'a'.repeat(40), workingTreeDirty: false }, sourceDigest: 'b'.repeat(64) })
  expect(await runE2ESuiteCli(['ci-full', '--topology=legacy-v1', '--shard-index=2', '--shard-total=2'])).toBe(0)
  const assigned = partitionE2ETasks(tasks, { index: 1, total: 2 })
  expect(vi.mocked(runTaskSuite).mock.calls[0]![1]).toEqual(assigned)
  expect(writeBaselineSuiteTelemetry).toHaveBeenCalledWith(plan, expect.any(Object), 2, assigned.map(task => task.label))
})

it('retains complete strict headless cases and explicit out-of-scope inventory', async () => {
  const selected = [...tasks, { label: 'ci/excluded.test.ts', command: 'fake-child', args: [], env: {}, outOfScopeReason: 'Explicitly excluded' }]
  vi.mocked(getSuiteTasks).mockResolvedValue(selected)
  vi.spyOn(taskCases, 'createPlannedTaskCaseReader').mockReturnValue(async task => [{ file: `e2e/${task.label}`, name: 'observable case' }])
  plan = await createBaselineSuitePlan({ suite: 'ide-dom-headless', topology: 'legacy-v1', shards: 1, tasks: selected, profile: currentVerificationProfile('ide-dom-headless'), identity: { runId: 'native-attempt-headless', commitSha: 'a'.repeat(40), workingTreeDirty: false }, sourceDigest: 'b'.repeat(64) })
  expect(await runE2ESuiteCli(['ide-dom-headless', '--topology=legacy-v1', '--allow-failures'])).toBe(0)
  const options = vi.mocked(runTaskSuite).mock.calls[0]![2]
  expect(options?.reportContext).toMatchObject({ strict: true, partial: false, plannedTasks: selected })
  expect(options?.reportContext?.plannedCases).toEqual(Object.fromEntries(tasks.map(task => [task.label, [{ file: `e2e/${task.label}`, name: 'observable case' }]])))
  expect(writeBaselineSuiteTelemetry).toHaveBeenCalledWith(plan, expect.any(Object), 1, tasks.map(task => task.label))
})

it('rejects a missing legacy shard selection instead of running the full inventory', async () => {
  plan = await createBaselineSuitePlan({ suite: 'ci-full', topology: 'legacy-v1', shards: 2, tasks, profile: currentVerificationProfile('ci-full'), identity: { runId: 'native-attempt-ci-full', commitSha: 'a'.repeat(40), workingTreeDirty: false }, sourceDigest: 'b'.repeat(64) })
  await expect(runE2ESuiteCli(['ci-full'])).rejects.toThrow('frozen legacy assignment')
  expect(runTaskSuite).not.toHaveBeenCalled()
})

it.each(['--filter=first', '--from=2', '--roll-from=2'])('rejects ad-hoc %s before any fake child starts', async (option) => {
  await runE2ESuiteCli(['ci-pr', option])
  expect(process.exitCode).toBe(1)
  expect(runTaskSuite).not.toHaveBeenCalled()
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
})

it.each(['--plan=separate-plan.json', '--shard-total=2', '--shard-index=2'])('rejects incompatible %s before fake execution', async (option) => {
  try {
    await runE2ESuiteCli(['ci-pr', option])
  }
  catch (error) {
    expect(error).toBeInstanceOf(Error)
  }
  expect(runTaskSuite).not.toHaveBeenCalled()
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
})

it('stops before execution on a missing or stale plan', async () => {
  vi.mocked(loadBaselineSuitePlan).mockRejectedValue(new Error('stale native attempt'))
  await runE2ESuiteCli(['ci-pr'])
  expect(process.exitCode).toBe(1)
  expect(runTaskSuite).not.toHaveBeenCalled()
})

it.each([1, 130] as const)('preserves failed or cancelled runner exit %i without publishing success evidence', async (code) => {
  vi.mocked(runTaskSuite).mockImplementation(async (_name, selected, options) => {
    options?.onReport?.(reportFor(selected, code === 130 ? 'cancelled' : 'failed'))
    return code
  })
  expect(await runE2ESuiteCli(['ci-pr'])).toBe(code)
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
})

it('preserves the original runner exception and never writes telemetry after it', async () => {
  const original = new Error('owned child cleanup failed')
  vi.mocked(runTaskSuite).mockRejectedValue(original)
  await expect(runE2ESuiteCli(['ci-pr'])).rejects.toBe(original)
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
})

it('preserves callback failure and refuses success without the original report', async () => {
  const original = new Error('original callback failed')
  await expect(runE2ESuiteCli(['ci-pr'], {
    onReport: () => {
      throw original
    },
  })).rejects.toBe(original)
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
  vi.mocked(runTaskSuite).mockResolvedValue(0)
  await expect(runE2ESuiteCli(['ci-pr'])).rejects.toThrow('original report')
  expect(writeBaselineSuiteTelemetry).not.toHaveBeenCalled()
})

it('awaits writer failures instead of returning a premature successful exit', async () => {
  const original = new Error('evidence write failed')
  vi.mocked(writeBaselineSuiteTelemetry).mockRejectedValue(original)
  await expect(runE2ESuiteCli(['ci-pr'])).rejects.toBe(original)
})
