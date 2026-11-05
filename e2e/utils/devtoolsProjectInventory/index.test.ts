import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGED_PROJECT_JOURNAL_ENV } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { OwnedCommandShutdownError } from '../../scripts/ownedE2ECommand/shutdown'
import { scanDevtoolsProjectInventory } from './index'
import { inventoryScanResult } from './protocol'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), wait: vi.fn(), scope: vi.fn(), record: vi.fn(), stopped: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('../../scripts/ownedE2ECommand/shutdown', async original => ({
  ...await original<typeof import('../../scripts/ownedE2ECommand/shutdown')>(),
  waitForOwnedCommand: mocks.wait,
}))
vi.mock('./ownership', () => ({ withInventoryCommandScope: mocks.scope }))

function successfulExit() {
  const args = mocks.execute.mock.calls.at(-1)![1] as string[]
  return { exitCode: 0, stdout: JSON.stringify(inventoryScanResult(args[3]!, args[4]!)), stderr: '' }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.execute.mockReturnValue({ owned: true })
  mocks.wait.mockImplementation(async () => successfulExit())
  mocks.record.mockResolvedValue(undefined)
  mocks.scope.mockImplementation(async (_request, run) => await run({
    environment: { TEST_SCANNER_SCOPE: 'scanner-scope' },
    stateDirectory: path.resolve('isolated-test-state'),
    recordChild: mocks.record,
    confirmStopped: mocks.stopped,
  }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('owned inventory scanner transport', () => {
  it('launches the selected Node with a fixed tsx entry and strips the IDE journal credential', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, 'parent-journal-must-not-be-inherited')
    const controller = new AbortController()
    await scanDevtoolsProjectInventory('relative-inventory', { signal: controller.signal })
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(process.execPath, [
      '--import',
      'tsx',
      expect.stringMatching(/[/\\]devtoolsProjectInventory[/\\]child\.ts$/),
      path.resolve('relative-inventory'),
      expect.any(String),
      path.resolve('isolated-test-state'),
    ], expect.objectContaining({
      cwd: path.resolve(import.meta.dirname, '../../..'),
      env: { TEST_SCANNER_SCOPE: 'scanner-scope', [MANAGED_PROJECT_JOURNAL_ENV]: undefined },
      shell: false,
      reject: false,
      killDescendants: true,
      killSignal: 'SIGKILL',
      forceKillAfterDelay: false,
    }))
    expect(mocks.wait).toHaveBeenCalledExactlyOnceWith({ owned: true }, expect.any(AbortSignal))
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith({ owned: true })
    expect(mocks.stopped).toHaveBeenCalledOnce()
  })

  it('does not spawn when cancellation already arrived', async () => {
    const reason = new Error('cancelled before scan')
    await expect(scanDevtoolsProjectInventory('inventory', { signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.scope).not.toHaveBeenCalled()
  })

  it('waits for the owned command exit before accepting success output', async () => {
    const exit = Promise.withResolvers<ReturnType<typeof successfulExit>>()
    mocks.wait.mockReturnValue(exit.promise)
    let finished = false
    const scan = scanDevtoolsProjectInventory('inventory').then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    exit.resolve(successfulExit())
    await scan
    expect(finished).toBe(true)
  })

  it('keeps a cancellation reason that races the successful exit', async () => {
    const controller = new AbortController()
    const reason = new Error('suite deadline')
    mocks.wait.mockImplementation(async () => {
      controller.abort(reason)
      return successfulExit()
    })
    await expect(scanDevtoolsProjectInventory('inventory', { signal: controller.signal })).rejects.toBe(reason)
  })

  it('keeps unconfirmed shutdown ahead of the ordinary cancellation reason', async () => {
    const controller = new AbortController()
    const failure = new OwnedCommandShutdownError('owned scanner stop is unconfirmed')
    mocks.wait.mockImplementation(async () => {
      controller.abort(new Error('suite deadline'))
      throw failure
    })
    await expect(scanDevtoolsProjectInventory('inventory', { signal: controller.signal })).rejects.toBe(failure)
  })

  it('provides a finite default deadline and clears its timer after shutdown', async () => {
    mocks.wait.mockImplementation(async (_child, signal: AbortSignal) => {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      return { exitCode: undefined, signal: 'SIGTERM' }
    })
    await expect(scanDevtoolsProjectInventory('inventory', { timeoutMs: 10 })).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(mocks.wait).toHaveBeenCalledOnce()
  })

  it('preserves the supplied budget without introducing an earlier timeout', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    await scanDevtoolsProjectInventory('inventory', { signal: controller.signal })
    const childSignal = mocks.wait.mock.calls[0]![1] as AbortSignal
    const reason = new Error('caller budget')
    controller.abort(reason)
    expect(childSignal.reason).toBe(reason)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    { exitCode: 7, signal: undefined, failed: true },
    { exitCode: undefined, signal: 'SIGTERM', failed: true },
    { exitCode: 0, signal: undefined, failed: true },
  ])('rejects unsuccessful exit even with success output: $exitCode/$signal', async (result) => {
    mocks.wait.mockImplementation(async () => ({ ...successfulExit(), ...result, stderr: 'scan failure evidence' }))
    await expect(scanDevtoolsProjectInventory('inventory')).rejects.toThrow(/exited unsuccessfully.*scan failure evidence/)
  })

  it('rejects a clean exit whose protocol does not identify this scanner request', async () => {
    mocks.wait.mockResolvedValue({ exitCode: 0, stdout: '{}', stderr: '' })
    await expect(scanDevtoolsProjectInventory('inventory')).rejects.toThrow(/does not match the owned request/)
  })

  it('stops the owned command if persisting its identity fails', async () => {
    const failure = new Error('scanner record could not be saved')
    mocks.record.mockRejectedValue(failure)
    mocks.wait.mockImplementation(async (_child, signal: AbortSignal) => {
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
      return { exitCode: undefined, signal: 'SIGTERM' }
    })
    await expect(scanDevtoolsProjectInventory('inventory')).rejects.toBe(failure)
    expect(mocks.stopped).toHaveBeenCalledOnce()
  })
})
