import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runOwnedE2ECommand } from './ownedE2ECommand'
import { OwnedCommandShutdownError } from './ownedE2ECommand/shutdown'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  journal: vi.fn(),
  cleanup: vi.fn(),
  lease: vi.fn(),
  wait: vi.fn(),
  seal: vi.fn(),
  complete: vi.fn(),
}))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('./ownedE2ECommand/shutdown', async original => ({
  ...await original<typeof import('./ownedE2ECommand/shutdown')>(),
  waitForOwnedCommand: mocks.wait,
}))
vi.mock('../utils/devtoolsProcessOwnership', () => ({ createDevtoolsProjectJournal: mocks.journal }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
  cleanupManagedWechatProjects: mocks.cleanup,
}))
vi.mock('../../packages/devtools-runtime/src/lease/machine', () => ({ withMachineE2ELease: mocks.lease }))

describe('outer E2E command ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.lease.mockImplementation(async run => await run({
      environment: { WEAPP_VITE_E2E_MACHINE_LEASE: 'held-lease' },
      createChildScope: async () => ({ environment: { WEAPP_VITE_E2E_MACHINE_LEASE: 'command-scope' }, seal: mocks.seal, complete: mocks.complete }),
    }))
    mocks.seal.mockResolvedValue(undefined)
    mocks.complete.mockResolvedValue(undefined)
    mocks.journal.mockResolvedValue('owned-command-journal')
    mocks.cleanup.mockResolvedValue(undefined)
    mocks.execute.mockResolvedValue({ exitCode: 0 })
    mocks.wait.mockImplementation(async child => await child)
  })

  it('keeps the machine lease until the exited child project journal is fully released', async () => {
    const cleanup = Promise.withResolvers<void>()
    const cleaning = Promise.withResolvers<void>()
    const events: string[] = []
    mocks.lease.mockImplementation(async (run) => {
      events.push('lease-held')
      try {
        return await run({
          environment: { WEAPP_VITE_E2E_MACHINE_LEASE: 'held-lease' },
          createChildScope: async () => ({ environment: { WEAPP_VITE_E2E_MACHINE_LEASE: 'command-scope' }, seal: mocks.seal, complete: mocks.complete }),
        })
      }
      finally {
        events.push('lease-released')
      }
    })
    mocks.execute.mockImplementation(async () => {
      events.push('child-exited')
      return { exitCode: 0 }
    })
    mocks.cleanup.mockImplementation(async () => {
      events.push('cleanup-started')
      cleaning.resolve()
      await cleanup.promise
      events.push('cleanup-finished')
    })
    const running = runOwnedE2ECommand('pnpm', ['e2e:ide:full'])
    await cleaning.promise
    expect(events).toEqual(['lease-held', 'child-exited', 'cleanup-started'])
    expect(mocks.execute).toHaveBeenCalledWith('pnpm', ['e2e:ide:full'], expect.objectContaining({
      env: { WEAPP_VITE_E2E_MACHINE_LEASE: 'command-scope', WEAPP_IDE_MANAGED_PROJECT_JOURNAL: 'owned-command-journal' },
      reject: false,
      killDescendants: true,
      killSignal: 'SIGKILL',
      forceKillAfterDelay: false,
    }))
    expect(mocks.cleanup).toHaveBeenCalledExactlyOnceWith({ journalPath: 'owned-command-journal', scope: 'journal' })
    cleanup.resolve()
    expect(await running).toBe(0)
    expect(events).toEqual(['lease-held', 'child-exited', 'cleanup-started', 'cleanup-finished', 'lease-released'])
  })

  it('reports cancellation only after the spawned command has exited and cleanup completes', async () => {
    const controller = new AbortController()
    const child = Promise.withResolvers<{ exitCode: number }>()
    const started = Promise.withResolvers<void>()
    mocks.execute.mockImplementation(() => {
      started.resolve()
      return child.promise
    })
    const running = runOwnedE2ECommand('node', ['runner'], { signal: controller.signal })
    await started.promise
    controller.abort()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    child.resolve({ exitCode: 0 })
    expect(await running).toBe(1)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it('preserves child command failure after successful cleanup', async () => {
    const failure = new Error('child launch failed')
    mocks.execute.mockRejectedValue(failure)
    await expect(runOwnedE2ECommand('node', ['runner'])).rejects.toBe(failure)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it.each([0, 7])('rejects incomplete cleanup even when the child returns %s', async (exitCode) => {
    const failure = new Error('window is still present')
    mocks.execute.mockResolvedValue({ exitCode })
    mocks.cleanup.mockRejectedValue(failure)
    await expect(runOwnedE2ECommand('node', ['runner'])).rejects.toMatchObject({ errors: [failure] })
  })

  it('preserves command and cleanup failures together', async () => {
    const command = new Error('command failed')
    const cleanup = new Error('cleanup failed')
    mocks.execute.mockRejectedValue(command)
    mocks.cleanup.mockRejectedValue(cleanup)
    await expect(runOwnedE2ECommand('node', ['runner'])).rejects.toMatchObject({ errors: [command, cleanup] })
  })

  it('does not allocate a command or journal for an already aborted request', async () => {
    expect(await runOwnedE2ECommand('node', ['runner'], { signal: AbortSignal.abort() })).toBe(1)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.journal).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('preserves the journal when the process tree cannot be confirmed stopped', async () => {
    const failure = new OwnedCommandShutdownError('still running')
    mocks.wait.mockRejectedValue(failure)
    await expect(runOwnedE2ECommand('node', ['runner'])).rejects.toBe(failure)
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })

  it('does not return success when cancellation first arrives during journal cleanup', async () => {
    const controller = new AbortController()
    mocks.cleanup.mockImplementation(async () => {
      controller.abort()
    })
    expect(await runOwnedE2ECommand('node', ['runner'], { signal: controller.signal })).toBe(1)
  })

  it('does not clean the journal if a detached borrower remains after the command exits', async () => {
    mocks.seal.mockRejectedValue(new Error('child is still running'))
    await expect(runOwnedE2ECommand('node', ['runner'])).rejects.toThrow('child is still running')
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
})
