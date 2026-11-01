import type { SuiteReportContext, SuiteReportPayload } from '../suiteReport'
import type { SuiteTask } from '../suiteRunner'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatSuiteSummary, runTaskSuite } from '../suiteRunner'
import { currentVerificationProfile } from '../verification/profile'

const mocks = vi.hoisted(() => ({ journal: vi.fn(), cleanup: vi.fn(), validate: vi.fn() }))
vi.mock('../../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../utils/devtoolsScopeCleanup', () => ({ cleanupDevtoolsCommandScope: mocks.cleanup }))
vi.mock('../domAcceptanceReport/task', () => ({ validateTaskAcceptance: mocks.validate }))
vi.mock('../../../packages/devtools-runtime/src/lease/machine', () => ({
  withMachineE2ELease: async <T>(run: (lease: unknown) => Promise<T>) => run({
    createChildScope: async () => ({ environment: {}, seal: async () => {} }),
  }),
}))

let temporaryRoot: string
let previousExitCode: typeof process.exitCode
const reports: SuiteReportPayload[] = []

beforeEach(() => {
  previousExitCode = process.exitCode
  process.exitCode = undefined
  vi.resetAllMocks()
  vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-completion-'))
  mocks.journal.mockResolvedValue(path.join(temporaryRoot, 'journal'))
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.validate.mockResolvedValue(undefined)
})
afterEach(() => {
  for (const report of reports.splice(0)) {
    fs.rmSync(report.reportDir, { recursive: true, force: true })
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
  process.exitCode = previousExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function task(label: string): SuiteTask {
  return { label, command: 'mock-task-command', args: [] }
}

function context(plannedTasks: SuiteTask[], partial = false, strict = false): SuiteReportContext {
  return { runId: path.basename(temporaryRoot), commitSha: 'a'.repeat(40), workingTreeDirty: false, plannedTasks, partial, strict }
}

function shardContext(plannedTasks: SuiteTask[], assignedTasks: SuiteTask[]): SuiteReportContext {
  return {
    ...context(plannedTasks, true, true),
    execution: {
      scope: 'shard',
      status: 'incomplete',
      profile: currentVerificationProfile('ci'),
      planHash: 'b'.repeat(64),
      shardIndex: 1,
      shardTotal: 2,
      assignedTasks: assignedTasks.map(task => task.label),
      startedAt: new Date().toISOString(),
      finishedAt: '',
    },
  }
}

async function run(tasks: SuiteTask[], reportContext: SuiteReportContext, runTask: (task: SuiteTask) => Promise<number> = vi.fn(async (_task: SuiteTask) => 0)) {
  const code = await runTaskSuite('e2e:completion-unit', tasks, {
    runTask,
    reportContext,
    failOnTaskFailure: false,
    stopOnTaskFailure: false,
    onReport: report => reports.push(report),
  })
  return { code, report: reports.at(-1)!, runTask }
}

function summaryOutput() {
  return vi.mocked(console.log).mock.calls.map(args => args.join(' ')).join('\n')
}

describe('suite completion against the declared execution scope', () => {
  it('fails a non-strict full run that omits a planned task even when every child passes', async () => {
    const tasks = [task('selected'), task('missing')]
    const { code, report, runTask } = await run(tasks.slice(0, 1), context(tasks))

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(runTask).toHaveBeenCalledTimes(1)
    expect(report.execution?.status).toBe('incomplete')
    expect(report.summary).toMatchObject({ plannedCount: 2, executedCount: 1, notExecutedCount: 1 })
    expect(report.tasks[1]?.status).toBe('not-executed')
    expect(summaryOutput()).toContain('summary 1/2 passed')
    expect(summaryOutput()).not.toContain('all tasks passed')
  })

  it('preserves successful intentional partial execution without claiming full acceptance', async () => {
    const tasks = [task('selected'), task('not-selected')]
    const { code, report } = await run(tasks.slice(0, 1), context(tasks, true))

    expect(code).toBe(0)
    expect(process.exitCode).toBeUndefined()
    expect(report.execution).toMatchObject({ scope: 'ad-hoc', status: 'passed', assignedTasks: ['selected'] })
    expect(report.coverage).toBe('partial')
    expect(report.acceptance).toBe('incomplete')
    expect(report.summary.notExecutedCount).toBe(1)
  })

  it('completes a strict frozen shard without treating other shards as missing work', async () => {
    const tasks = [task('assigned'), task('other-shard')]
    const { code, report } = await run(tasks.slice(0, 1), shardContext(tasks, tasks.slice(0, 1)))

    expect(code).toBe(0)
    expect(process.exitCode).toBeUndefined()
    expect(report.execution).toMatchObject({ scope: 'shard', status: 'passed', assignedTasks: ['assigned'] })
    expect(report.summary).toMatchObject({ plannedCount: 2, executedCount: 1, notExecutedCount: 1 })
    expect(report.tasks[1]?.status).toBe('not-executed')
  })

  it('does not shrink frozen shard assignment when an assigned task is omitted', async () => {
    const tasks = [task('assigned-first'), task('assigned-missing'), task('other-shard')]
    const { code, report } = await run(tasks.slice(0, 1), shardContext(tasks, tasks.slice(0, 2)))

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(report.execution).toMatchObject({ status: 'incomplete', assignedTasks: ['assigned-first', 'assigned-missing'] })
    expect(summaryOutput()).toContain('summary 1/2 passed')
    expect(summaryOutput()).not.toContain('all tasks passed')
  })

  it('does not require an explicitly out-of-scope task to execute', async () => {
    const tasks = [task('active'), { ...task('outside'), outOfScopeReason: 'Outside the declared provider contract' }]
    const { code, report, runTask } = await run(tasks, context(tasks))

    expect(code).toBe(0)
    expect(runTask).toHaveBeenCalledTimes(1)
    expect(report.execution?.status).toBe('passed')
    expect(report.summary).toMatchObject({ plannedCount: 1, executedCount: 1, outOfScopeCount: 1, notExecutedCount: 0 })
  })

  it('fails a final unsafe task without relying on missing tasks or ordinary failure policy', async () => {
    const tasks = [task('last-task')]
    const first = 'first terminal runtime diagnostic'
    const runTask = vi.fn(async (task: SuiteTask) => {
      task.unsafeRuntimeReason = first
      return 0
    })
    const { code, report } = await run(tasks, context(tasks), runTask)

    expect(code).toBe(1)
    expect(process.exitCode).toBe(1)
    expect(report.execution?.status).toBe('failed')
    expect(report.tasks[0]).toMatchObject({ status: 'failed', exitCode: 1, reason: first })
    expect(report.summary).toMatchObject({ executedCount: 1, failedCount: 1, notExecutedCount: 0 })
    expect(summaryOutput()).not.toContain('all tasks passed')
  })

  it('preserves the first unsafe diagnostic together with a later task failure', async () => {
    const tasks = [task('first-task'), task('must-not-run')]
    const first = 'first unsafe runtime diagnostic'
    const later = 'later task-process failure'
    const runTask = vi.fn(async (task: SuiteTask) => {
      task.unsafeRuntimeReason = first
      throw new Error(later)
    })
    const { code, report } = await run(tasks, context(tasks), runTask)

    expect(code).toBe(1)
    expect(runTask).toHaveBeenCalledTimes(1)
    expect(report.tasks[0]?.reason).toContain(first)
    expect(report.tasks[0]?.reason).toContain(later)
    expect(report.tasks[0]?.reason?.indexOf(first)).toBeLessThan(report.tasks[0]!.reason!.indexOf(later))
    expect(report.tasks[1]?.status).toBe('not-executed')
  })

  it('continues ordinary permitted failures without forcing process exitCode', async () => {
    const tasks = [task('ordinary-failure'), task('following')]
    const runTask = vi.fn<(task: SuiteTask) => Promise<number>>().mockResolvedValueOnce(7).mockResolvedValueOnce(0)
    const { code, report } = await run(tasks, context(tasks), runTask)

    expect(code).toBe(1)
    expect(runTask).toHaveBeenCalledTimes(2)
    expect(process.exitCode).toBeUndefined()
    expect(report.execution?.status).toBe('failed')
    expect(report.tasks[0]).toMatchObject({ status: 'failed', exitCode: 7 })
  })

  it('does not summarize an interrupted prefix as all planned tasks passed', () => {
    const result = { label: 'finished', exitCode: 0, durationMs: 1, artifacts: [] }
    const summary = formatSuiteSummary('e2e:completion-unit', [result], 3)

    expect(summary).toContain('summary 1/3 passed')
    expect(summary).toContain('2 task(s) not executed')
    expect(summary).not.toContain('all tasks passed')
    expect(formatSuiteSummary('e2e:completion-unit', [result])).toContain('all tasks passed')
  })
})
