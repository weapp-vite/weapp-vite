import type { MachineE2EChildScope } from '../../../../packages/devtools-runtime/src/lease/machine'
import type { NestedRunnerReady } from './evidence'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkKilledNestedRunner } from './index'

const mocks = vi.hoisted(() => ({ execa: vi.fn(), journal: vi.fn(), records: vi.fn(), cleanup: vi.fn(), released: vi.fn(), allReleased: vi.fn(), runtime: vi.fn(), scopes: vi.fn(), createScope: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execa }))
vi.mock('../../../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../../utils/devtoolsScopeCleanup', () => ({ cleanupDevtoolsCommandScope: mocks.cleanup }))
vi.mock('../../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
  readManagedWechatProjectRecords: mocks.records,
}))
vi.mock('../context', () => ({
  REPO_ROOT: '.',
  START_TIMEOUT: 120_000,
  isRecord: (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value),
  assertSessionReleased: mocks.released,
  assertJournalReleased: mocks.allReleased,
  readRuntimeEvidence: mocks.runtime,
}))
vi.mock('./evidence', async importOriginal => ({ ...await importOriginal<object>(), readNestedRunnerScopes: mocks.scopes }))

let directory: string
let runnerJournal: string
let runnerScope: MachineE2EChildScope
let options: Parameters<typeof checkKilledNestedRunner>[0]
let evidence: NestedRunnerReady

beforeEach(async () => {
  vi.resetAllMocks()
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lifecycle-nested-runner-'))
  runnerJournal = path.join(directory, 'children', 'runner')
  const info = { version: 'selected-version', SDKVersion: 'fixture-sdk' }
  const target = { cliPath: path.join(directory, 'cli'), installationId: 'selected-installation', appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), version: info.version }
  const protectedSession = { id: 'protected-window', journalPath: directory, projectPath: path.join(directory, 'protected-project'), port: 19002, info, ownerHost: { pid: process.pid + 2, executable: 'protected-listener', started: 'protected-start' }, program: {} as Parameters<typeof checkKilledNestedRunner>[0]['protectedSession']['program'] }
  runnerScope = { environment: { WEAPP_VITE_E2E_MACHINE_LEASE: 'runner-credential' }, seal: vi.fn(), complete: vi.fn(), recoverStoppedDescendants: vi.fn() }
  options = {
    projectPath: path.join(directory, 'runner-project'),
    cliPath: target.cliPath,
    sdkVersion: info.SDKVersion,
    selectedVersion: info.version,
    lease: { borrowed: true, released: false, environment: {}, release: vi.fn(), createChildScope: mocks.createScope },
    target,
    protectedSession,
    scriptPath: path.join(directory, 'worker.ts'),
    journalPath: directory,
    runDirectory: directory,
    signal: new AbortController().signal,
  }
  const parent = { id: randomUUID(), owner: { pid: process.pid, token: randomUUID() }, ancestors: [], sealed: false, completed: false, cleanupKey: runnerJournal }
  const child = { ...parent, id: randomUUID(), ancestors: [parent.id], cleanupKey: path.join(runnerJournal, 'children', 'task') }
  evidence = { pid: process.pid + 1, id: 'runner-window', journalPath: child.cleanupKey, projectPath: options.projectPath, port: 19001, info, ownerHost: { pid: process.pid + 3, executable: 'runner-listener', started: 'runner-start' }, scope: child }
  const before = { scopeId: parent.id, scopes: [parent, child], borrowers: [{ pid: evidence.pid, token: randomUUID(), scopes: [parent.id, child.id] }] }
  mocks.scopes.mockResolvedValueOnce(before).mockResolvedValue({ ...before, scopes: before.scopes.map(scope => ({ ...scope, sealed: true, completed: true })), borrowers: [] })
  mocks.journal.mockResolvedValue(runnerJournal)
  mocks.createScope.mockResolvedValue(runnerScope)
  mocks.cleanup.mockResolvedValue(undefined)
  mocks.runtime.mockResolvedValue(info)
  mocks.released.mockResolvedValue({ portClosed: true, windowClose: { nativeClosedAt: 'closed', webContentsDestroyedAt: 'destroyed' } })
  mocks.allReleased.mockResolvedValue([])
  mocks.records.mockImplementation(async (journalPath: string) => journalPath === directory
    ? [{ ...protectedSession, state: 'owned', host: protectedSession.ownerHost, target }]
    : [{ id: evidence.id, ownerPid: evidence.pid, state: 'owned', openedProjectWindow: true, projectPath: options.projectPath, host: evidence.ownerHost, target }])
})

afterEach(async () => {
  vi.useRealTimers()
  await fs.rm(directory, { recursive: true, force: true })
})

function runner(actualSignal: string | undefined = 'SIGKILL', mutateReady?: (ready: NestedRunnerReady) => void, neverExits = false) {
  const result = Promise.withResolvers<{ signal?: string, exitCode?: number, stdout: string, stderr: string }>()
  const stdout = new EventEmitter()
  const child = Object.assign(result.promise, {
    pid: evidence.pid,
    stdout,
    kill: vi.fn(() => {
      if (!neverExits) {
        result.resolve({ signal: actualSignal, exitCode: actualSignal ? undefined : 0, stdout: 'nested runner output', stderr: '' })
      }
      return true
    }),
  })
  mocks.execa.mockImplementation(() => {
    const ready = structuredClone(evidence)
    mutateReady?.(ready)
    queueMicrotask(() => stdout.emit('data', `DEVTOOLS_LIFECYCLE_NESTED_RUNNER_READY:${JSON.stringify(ready)}\n`))
    return child
  })
  return { child, result }
}

async function rejection(run: Promise<unknown>): Promise<AggregateError> {
  const result = await run.then(() => undefined, error => error)
  expect(result).toBeInstanceOf(AggregateError)
  return result as AggregateError
}

describe('nested suite runner SIGKILL ownership recovery', () => {
  it('does not create a scope, journal, or subprocess after cancellation', async () => {
    const reason = new Error('already cancelled')
    options.signal = AbortSignal.abort(reason)
    await expect(checkKilledNestedRunner(options)).rejects.toBe(reason)
    expect(mocks.journal).not.toHaveBeenCalled()
    expect(mocks.createScope).not.toHaveBeenCalled()
    expect(mocks.execa).not.toHaveBeenCalled()
  })

  it('recovers the exact bound subtree after SIGKILL and preserves a different listener on the same installation', async () => {
    const { child } = runner()
    const report = await checkKilledNestedRunner(options)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(mocks.createScope).toHaveBeenCalledExactlyOnceWith({ cleanupKey: runnerJournal })
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith(runnerScope, runnerJournal)
    expect(mocks.cleanup.mock.invocationCallOrder[0]).toBeGreaterThan(child.kill.mock.invocationCallOrder[0]!)
    expect(mocks.execa.mock.calls[0]![1]).toContain('--nested-runner')
    expect(mocks.execa.mock.calls[0]![2]).toMatchObject({ killDescendants: false, env: { ...runnerScope.environment, WEAPP_IDE_MANAGED_PROJECT_JOURNAL: runnerJournal } })
    expect(mocks.scopes).toHaveBeenNthCalledWith(1, runnerScope.environment)
    expect(mocks.scopes).toHaveBeenNthCalledWith(2, runnerScope.environment)
    expect(mocks.runtime).toHaveBeenCalledTimes(2)
    expect(mocks.released).toHaveBeenCalledExactlyOnceWith(evidence)
    expect(mocks.allReleased).toHaveBeenCalledExactlyOnceWith(runnerJournal)
    expect(report).toMatchObject({ killed: { signal: 'SIGKILL' }, cleanup: { portClosed: true, windowClose: { nativeClosedAt: 'closed', webContentsDestroyedAt: 'destroyed' } }, protectedBefore: { state: 'owned' }, protectedAfter: { state: 'owned' } })
    expect(report.scopesAfter.scopes.every(scope => scope.sealed && scope.completed)).toBe(true)
    expect(await fs.readFile(path.join(directory, 'nested-runner.log'), 'utf8')).toContain('nested runner output')
  })

  it('still SIGKILLs only its owned handle and cleans the bound scope when ready validation fails', async () => {
    const { child } = runner('SIGKILL', ready => ready.pid++)
    const error = await rejection(checkKilledNestedRunner(options))
    expect(error.errors.some(value => String(value).includes('created nested runner'))).toBe(true)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith(runnerScope, runnerJournal)
    expect(mocks.released).not.toHaveBeenCalled()
  })

  it('rejects a normal exit even if the signal request returned true', async () => {
    runner('')
    const error = await rejection(checkKilledNestedRunner(options))
    expect(error.errors.some(value => String(value).includes('actual SIGKILL exit'))).toBe(true)
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith(runnerScope, runnerJournal)
    expect(mocks.released).not.toHaveBeenCalled()
  })

  it('retains the original evidence failure alongside cleanup failure', async () => {
    runner('SIGKILL', ready => ready.pid++)
    const cleanupFailure = new Error('descendant window destruction not confirmed')
    mocks.cleanup.mockRejectedValue(cleanupFailure)
    const error = await rejection(checkKilledNestedRunner(options))
    expect(error.errors.some(value => String(value).includes('created nested runner'))).toBe(true)
    expect(error.errors).toContain(cleanupFailure)
    expect(mocks.released).not.toHaveBeenCalled()
    expect(mocks.runtime).toHaveBeenCalledOnce()
  })

  it('preserves scope and journal if the exact owned subprocess exit remains unconfirmed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { child } = runner('SIGKILL', undefined, true)
    const running = rejection(checkKilledNestedRunner(options))
    await vi.advanceTimersByTimeAsync(10_000)
    const error = await running
    expect(error.errors.some(value => String(value).includes('did not stop after SIGKILL'))).toBe(true)
    expect(error.errors.some(value => String(value).includes('exit remains unconfirmed'))).toBe(true)
    expect(child.kill).toHaveBeenCalledExactlyOnceWith('SIGKILL')
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.released).not.toHaveBeenCalled()
    expect(mocks.scopes).toHaveBeenCalledOnce()
  })
})
