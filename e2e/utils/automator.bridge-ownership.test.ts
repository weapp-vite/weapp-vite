import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { randomUUID } from 'node:crypto'
import { Automator } from '@weapp-vite/miniprogram-automator'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { launchAutomatorViaCliBridge } from './automator'
import { AutomatorLaunchLifecycle } from './automatorLaunchLifecycle'
import { cleanupOwnedDevtoolsProcesses } from './devtoolsProcessOwnership'
import { getManagedProjectSessionOwner } from './managedProjectSession'

const { execaMock, createJournal, cleanupJournal, closeProject } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  createJournal: vi.fn<(parent?: string) => Promise<string>>(),
  cleanupJournal: vi.fn<(options: { journalPath?: string, scope?: 'process' | 'journal' }) => Promise<void>>(),
  closeProject: vi.fn<(options: { id: string, journalPath?: string }) => Promise<void>>(),
}))

vi.mock('execa', () => ({ execa: execaMock }))
vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))
vi.mock('./devtoolsProcessOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./devtoolsProcessOwnership')>()
  return { ...actual, createDevtoolsProjectJournal: createJournal }
})
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership')>()
  return { ...actual, cleanupManagedWechatProjects: cleanupJournal, closeManagedWechatProject: closeProject }
})

const parentJournal = 'owned-task-journal'
const rootCleanup = { journalPath: parentJournal, scope: 'journal' } as const
let attemptJournals: string[]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, parentJournal)
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  vi.spyOn(Automator.prototype, 'connect')
  attemptJournals = []
  createJournal.mockImplementation(async (parent) => {
    const journal = `${parent}/children/attempt-${attemptJournals.length + 1}`
    attemptJournals.push(journal)
    return journal
  })
  cleanupJournal.mockResolvedValue(undefined)
  closeProject.mockResolvedValue(undefined)
})

afterEach(async () => {
  try {
    // 失败断言也必须结算真实 registry，避免把上一 case 的 owner 带到下一 case。
    cleanupJournal.mockReset().mockResolvedValue(undefined)
    closeProject.mockReset().mockResolvedValue(undefined)
    await cleanupOwnedDevtoolsProcesses(rootCleanup)
  }
  finally {
    vi.clearAllTimers()
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  }
})

function prepareLaunch(connectFailure?: Error) {
  const disconnect = vi.fn(async () => {})
  const rawClose = vi.fn(async () => {})
  const session = { close: rawClose, disconnect }
  const onManagedProject = vi.fn<(close: () => Promise<void>) => void>()
  const onSessionMetadata = vi.fn(async (_metadata: unknown) => {})
  const managedProject = { id: randomUUID(), journalPath: 'receipt-only-journal' }
  execaMock.mockImplementationOnce(async (_command: string, _args: string[], options: { env: Record<string, string> }) => {
    managedProject.journalPath = options.env[MANAGED_PROJECT_JOURNAL_ENV] || managedProject.journalPath
    return { exitCode: 0, stdout: JSON.stringify({ wsEndpoint: 'ws://127.0.0.1:9415', managedProject }) }
  })
  if (connectFailure) {
    vi.mocked(Automator.prototype.connect).mockRejectedValueOnce(connectFailure)
  }
  else {
    vi.mocked(Automator.prototype.connect).mockResolvedValueOnce(session as unknown as MiniProgram)
  }
  const lifecycle = new AutomatorLaunchLifecycle(10_000, 'bridge ownership')
  const promise = lifecycle.run(scope => launchAutomatorViaCliBridge(
    { projectPath: 'fixture' },
    'fixture',
    scope,
    undefined,
    onSessionMetadata,
    onManagedProject,
  ))
  return { session, disconnect, rawClose, managedProject, onManagedProject, onSessionMetadata, promise }
}

async function launchSession() {
  const launched = prepareLaunch()
  const assertion = expect(launched.promise).resolves.toBe(launched.session)
  await vi.runAllTimersAsync()
  await assertion
  return launched
}

function attemptCleanups() {
  return cleanupJournal.mock.calls.map(([options]) => options).filter(options => attemptJournals.includes(options.journalPath ?? ''))
}

describe('automator bridge project ownership', () => {
  it('retires all sixteen successful attempt owners before global cleanup', async () => {
    const launches: Array<Awaited<ReturnType<typeof launchSession>>> = []
    for (let index = 0; index < 16; index++) {
      const launched = await launchSession()
      launches.push(launched)
      await launched.session.close()
    }
    const beforeGlobalCleanup = attemptCleanups()
    await cleanupOwnedDevtoolsProcesses(rootCleanup)

    expect(launches).toHaveLength(16)
    expect(beforeGlobalCleanup).toEqual(attemptJournals.map(journalPath => ({ journalPath, scope: 'journal' })))
    expect(attemptCleanups()).toEqual(beforeGlobalCleanup)
    expect(cleanupJournal.mock.calls.map(([options]) => options)).toEqual([...beforeGlobalCleanup, rootCleanup])
    expect(closeProject).not.toHaveBeenCalled()
    for (const launched of launches) {
      expect(launched.onManagedProject).toHaveBeenCalledOnce()
      expect(getManagedProjectSessionOwner(launched.session)).toBe(launched.onManagedProject.mock.calls[0]![0])
      expect(Reflect.get(launched.session, '__WEAPP_VITE_SESSION_METADATA')).toMatchObject({ managedProject: launched.managedProject })
      expect(launched.onSessionMetadata).toHaveBeenCalledExactlyOnceWith({
        projectPath: 'fixture',
        wsEndpoint: 'ws://127.0.0.1:9415',
        port: 9415,
        managedProject: launched.managedProject,
      })
      expect(launched.rawClose).not.toHaveBeenCalled()
    }
  })

  it('keeps the same attempt owner on disconnect and releases it once through global cleanup', async () => {
    const launched = await launchSession()
    const owner = launched.onManagedProject.mock.calls[0]![0]
    await launched.session.disconnect()
    expect(cleanupJournal).not.toHaveBeenCalled()
    expect(closeProject).not.toHaveBeenCalled()
    expect(getManagedProjectSessionOwner(launched.session)).toBe(owner)

    await cleanupOwnedDevtoolsProcesses(rootCleanup)
    await launched.session.close()
    await cleanupOwnedDevtoolsProcesses(rootCleanup)
    expect(attemptCleanups()).toEqual([{ journalPath: attemptJournals[0], scope: 'journal' }])
    expect(closeProject).not.toHaveBeenCalled()
    expect(launched.disconnect).toHaveBeenCalledOnce()
    expect(launched.rawClose).not.toHaveBeenCalled()
  })

  it('shares concurrent closes and retains a failed attempt owner for global retry', async () => {
    const launched = await launchSession()
    const release = Promise.withResolvers<void>()
    const cleanupFailure = new AggregateError([new Error('window destruction remains unconfirmed')], 'Attempt cleanup failed')
    cleanupJournal.mockImplementationOnce(async () => {
      await release.promise
      throw cleanupFailure
    })
    const first = launched.session.close()
    const second = launched.session.close()
    const outcome = first.then(() => ({ state: 'fulfilled' as const }), (error: unknown) => ({ state: 'rejected' as const, error }))
    try {
      expect(second).toBe(first)
      await vi.advanceTimersByTimeAsync(0)
      expect(attemptCleanups()).toHaveLength(1)
    }
    finally {
      release.resolve()
      await outcome
    }
    expect(await outcome).toMatchObject({ state: 'rejected', error: { errors: [cleanupFailure] } })
    await cleanupOwnedDevtoolsProcesses(rootCleanup)
    await launched.session.close()
    await cleanupOwnedDevtoolsProcesses(rootCleanup)
    expect(attemptCleanups()).toEqual(Array.from({ length: 2 }, () => ({ journalPath: attemptJournals[0], scope: 'journal' })))
    expect(getManagedProjectSessionOwner(launched.session)).toBe(launched.onManagedProject.mock.calls[0]![0])
    expect(closeProject).not.toHaveBeenCalled()
    expect(launched.disconnect).toHaveBeenCalledOnce()
  })

  it('preserves the original launch error and an unknown cleanup rejection', async () => {
    const launchFailure = new Error('unsupported protocol version')
    const cleanupFailure = { reason: 'unconfirmed attempt ownership' }
    cleanupJournal.mockRejectedValueOnce(cleanupFailure)
    const launched = prepareLaunch(launchFailure)
    const outcome = launched.promise.catch((error: unknown) => error)
    await vi.runAllTimersAsync()
    const failure = await outcome
    expect(failure).toBeInstanceOf(AggregateError)
    if (!(failure instanceof AggregateError)) {
      throw new Error('Expected the launch and cleanup failures to remain aggregated')
    }
    expect(failure.errors[0]).toBe(launchFailure)
    expect(failure.errors[1]).toBe(cleanupFailure)
    expect(failure.cause).toBe(launchFailure)
  })

  it('keeps receipt-specific ownership when no attempt journal was created', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, '')
    const launched = await launchSession()
    expect(createJournal).not.toHaveBeenCalled()
    expect(launched.onManagedProject).not.toHaveBeenCalled()
    expect(getManagedProjectSessionOwner(launched.session)).toBeTypeOf('function')
    await launched.session.disconnect()
    expect(closeProject).not.toHaveBeenCalled()
    await Promise.all([launched.session.close(), launched.session.close()])
    await cleanupOwnedDevtoolsProcesses(rootCleanup)
    expect(closeProject).toHaveBeenCalledExactlyOnceWith(launched.managedProject)
    expect(cleanupJournal).toHaveBeenCalledExactlyOnceWith(rootCleanup)
    expect(launched.rawClose).not.toHaveBeenCalled()
  })
})
