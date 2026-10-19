import type { SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { MachineE2EChildScope, MachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runTaskSuite } from '../../e2e/scripts/suiteRunner'
import { identity } from './fixtures'

const mocks = vi.hoisted(() => ({ journal: vi.fn(), cleanup: vi.fn(), scope: vi.fn() }))

// 本契约只有 mock 调度与租约，不能派发子进程或取得真实 IDE 资源。
vi.mock('../../e2e/utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../e2e/utils/devtoolsScopeCleanup', () => ({ cleanupDevtoolsCommandScope: mocks.cleanup }))
vi.mock('../../packages/devtools-runtime/src/lease/machine', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../packages/devtools-runtime/src/lease/machine')>()
  return { ...original, withMachineE2ELease: async <T>(run: (lease: MachineE2ELease) => Promise<T>) => run({ createChildScope: mocks.scope } as unknown as MachineE2ELease) }
})

let journalRoot: string
let previousExitCode: typeof process.exitCode
beforeEach(async () => {
  previousExitCode = process.exitCode
  journalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'suite-observer-'))
  mocks.journal.mockResolvedValue(path.join(journalRoot, 'journal'))
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.scope.mockResolvedValue({ environment: {} } as MachineE2EChildScope)
})

afterEach(async () => {
  await fs.rm(journalRoot, { recursive: true, force: true })
  process.exitCode = previousExitCode
  vi.restoreAllMocks()
})

it('records acquisition outside tasks and preserves existing execution context updates', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValue(250)
  const context = { ...identity, strict: false, partial: false, plannedTasks: [] }
  let captured: SuiteReportPayload | undefined
  try {
    expect(await runTaskSuite('unit-observer', [], { reportContext: context, onReport: report => captured = report })).toBe(0)
    expect(captured?.timings).toEqual([expect.objectContaining({ name: 'machine-lease-acquisition', durationMs: 150, status: 'passed' })])
    expect(captured?.tasks).toEqual([])
    expect(context).not.toHaveProperty('timings')
    expect(context).toHaveProperty('execution.status', 'passed')
  }
  finally {
    if (captured) {
      await fs.rm(captured.reportDir, { recursive: true, force: true })
    }
  }
})

it.each([
  { result: 0, phaseStatus: 'passed', taskStatus: 'passed' },
  { result: 7, phaseStatus: 'failed', taskStatus: 'failed' },
  { error: new Error('original process failure'), phaseStatus: 'failed', taskStatus: 'blocked' },
  { error: new DOMException('original process abort', 'AbortError'), phaseStatus: 'cancelled', taskStatus: 'blocked' },
] as const)('records $phaseStatus process timing while preserving its task result', async (scenario) => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let captured: SuiteReportPayload | undefined
  try {
    const exitCode = await runTaskSuite('unit-process-observer', [{ label: 'unit-task', command: 'node', args: [] }], {
      runTask: async () => {
        if ('error' in scenario) {
          throw scenario.error
        }
        return scenario.result
      },
      reportContext: { ...identity, strict: false, partial: false, plannedTasks: [{ label: 'unit-task' }] },
      onReport: report => captured = report,
    })
    expect(exitCode).toBe('result' in scenario && scenario.result === 0 ? 0 : 1)
    expect(captured?.tasks[0]).toMatchObject({ status: scenario.taskStatus, exitCode: 'error' in scenario ? 1 : scenario.result })
    expect(captured?.tasks[0]?.timings?.find(timing => timing.name === 'task-process')?.status).toBe(scenario.phaseStatus)
    if ('error' in scenario) {
      expect(captured?.tasks[0]?.reason).toBe(scenario.error.message)
    }
  }
  finally {
    if (captured) {
      await fs.rm(captured.reportDir, { recursive: true, force: true })
    }
  }
})
