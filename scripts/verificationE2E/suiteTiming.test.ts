import type { SuiteReportContext, SuiteReportPayload } from '../../e2e/scripts/suiteReport'
import type { SuiteTask } from '../../e2e/scripts/suiteRunner'
import type { MachineE2EChildScope, MachineE2ELease } from '../../packages/devtools-runtime/src/lease/machine'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { runTaskSuite } from '../../e2e/scripts/suiteRunner'
import { taskDefinitionHash } from '../../e2e/scripts/verification/plan'
import { resolveVerificationTopology, topologyEnvironment } from '../verification/topology.ts'
import { useIsolatedTopologyTestEnvironment } from '../verification/topologyTestFixture.ts'
import { identity } from './fixtures'

useIsolatedTopologyTestEnvironment()

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
  mocks.journal.mockClear()
  mocks.cleanup.mockClear()
  mocks.scope.mockClear()
  previousExitCode = process.exitCode
  journalRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'suite-observer-'))
  mocks.journal.mockResolvedValue(path.join(journalRoot, 'journal'))
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.scope.mockResolvedValue({ environment: {} } as MachineE2EChildScope)
})

afterEach(async () => {
  await fs.rm(journalRoot, { recursive: true, force: true })
  process.exitCode = previousExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('freezes inherited topology and exact task definitions before adding journal or child resources', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const topology = resolveVerificationTopology('legacy-v1')
  for (const [key, value] of Object.entries(topologyEnvironment(topology))) {
    vi.stubEnv(key, value)
  }
  const task: SuiteTask = { label: 'unit-task', command: 'node', args: [], env: { FIXTURE: 'original' } }
  const expectedHash = taskDefinitionHash(task)
  let captured: SuiteReportPayload | undefined
  try {
    expect(await runTaskSuite('unit-process-observer', [task], { runTask: async () => 0, reportContext: { ...identity, strict: false, partial: false, plannedTasks: [task] }, onReport: report => captured = report })).toBe(0)
    expect(captured?.execution?.executionTopology).toEqual(topology)
    expect(captured?.tasks[0]?.definitionHash).toBe(expectedHash)
    expect(taskDefinitionHash(task)).not.toBe(expectedHash)
  }
  finally {
    if (captured) {
      await fs.rm(captured.reportDir, { recursive: true, force: true })
    }
  }
})

it.each(['topology', 'task-definition'] as const)('rejects a changed frozen %s before launching task resources', async (fault) => {
  const task: SuiteTask = { label: 'unit-task', command: 'node', args: [] }
  const context: SuiteReportContext = { ...identity, strict: false, partial: false, plannedTasks: [task], executionTopology: resolveVerificationTopology(), taskDefinitions: { [task.label]: taskDefinitionHash(task) } }
  if (fault === 'topology') {
    context.executionTopology!.policyDigest = 'f'.repeat(64)
  }
  else {
    context.taskDefinitions![task.label] = 'f'.repeat(64)
  }
  const runTask = vi.fn(async () => 0)
  await expect(runTaskSuite('unit-process-observer', [task], { runTask, reportContext: context })).rejects.toThrow(/topology|task definition/)
  expect(runTask).not.toHaveBeenCalled()
  expect(mocks.journal).not.toHaveBeenCalled()
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
    if (scenario.error) {
      expect(captured?.tasks[0]?.reason).toBe(scenario.error.message)
    }
  }
  finally {
    if (captured) {
      await fs.rm(captured.reportDir, { recursive: true, force: true })
    }
  }
})
