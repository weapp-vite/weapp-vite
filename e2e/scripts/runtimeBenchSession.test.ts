import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeBenchSession } from './runtimeBenchSession'

const mocks = vi.hoisted(() => ({ launch: vi.fn(), cleanup: vi.fn(), closeProject: vi.fn(), waitForPortClosed: vi.fn() }))
vi.mock('../utils/automator', () => ({ launchAutomator: mocks.launch, isLikelyRelaunchRetryableError: () => true }))
vi.mock('../utils/ide-devtools-cleanup', () => ({ cleanupResidualDevtoolsProcesses: mocks.cleanup }))
vi.mock('./runtimeBench/resources', async (importOriginal) => {
  const original = await importOriginal<typeof import('./runtimeBench/resources')>()
  return {
    ...original,
    createBenchResourceRegistry: (options: Parameters<typeof original.createBenchResourceRegistry>[0]) => original.createBenchResourceRegistry({
      ...options,
      closeProject: mocks.closeProject,
      waitForPortClosed: mocks.waitForPortClosed,
    }),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'selected-stable-cli')
})
afterEach(() => vi.unstubAllEnvs())

function launchOwned(disconnect = vi.fn(async () => {})) {
  let index = 0
  mocks.launch.mockImplementation(async (options) => {
    const projectPath = `owned-snapshot-${++index}`
    await options.onOwnedSnapshot({ projectPath, cliPath: options.cliPath })
    const metadata = { projectPath, wsEndpoint: 'ws://127.0.0.1:9415', port: 9415, managedProject: { id: 'confirmed-owner', journalPath: 'task-journal' } }
    await options.onSessionMetadata(metadata)
    return { disconnect, __WEAPP_VITE_SESSION_METADATA: metadata }
  })
}

describe('runtime benchmark host ownership', () => {
  it('journals the failed attempt before launching its replacement session', async () => {
    const order: string[] = []
    launchOwned(vi.fn(async () => {
      order.push('close')
    }))
    const implementation = mocks.launch.getMockImplementation()!
    mocks.launch.mockImplementation(async (options) => {
      order.push('launch')
      return implementation(options)
    })
    const onRetry = vi.fn(async () => {
      order.push('journal')
    })
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'mock-project', runtimeProvider: 'devtools', onRetry })
    const operation = vi.fn().mockRejectedValueOnce(new Error('sample timeout')).mockResolvedValueOnce('ready')
    await expect(session.run('detail navigation sample 2/3', operation)).resolves.toBe('ready')
    expect(onRetry).toHaveBeenCalledWith({ attempt: 1, error: expect.objectContaining({ message: 'sample timeout' }), label: 'detail navigation sample 2/3' })
    expect(order).toEqual(['launch', 'close', 'journal', 'launch'])
    await session.close()
  })

  it('propagates and records host close errors exactly once', async () => {
    const close = vi.fn(async () => {
      throw new Error('owned host did not close')
    })
    const onCleanupError = vi.fn(async () => {})
    launchOwned(close)
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'mock-project', runtimeProvider: 'devtools', onCleanupError })
    await expect(session.close()).rejects.toThrow('owned host did not close')
    await expect(session.close()).rejects.toThrow('owned host did not close')
    expect(close).toHaveBeenCalledOnce()
    expect(onCleanupError).toHaveBeenCalledWith(expect.objectContaining({ message: 'owned host did not close' }))
    expect(onCleanupError).toHaveBeenCalledOnce()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })

  it('does not recover or launch another host when the previous close fails', async () => {
    launchOwned(vi.fn(async () => {
      throw new Error('close rejected')
    }))
    const onCleanupError = vi.fn(async () => {})
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'mock-project', runtimeProvider: 'devtools', onCleanupError })
    await expect(session.run('sample', async () => {
      throw new Error('sample timeout')
    })).rejects.toThrow('sample and session cleanup failed')
    expect(mocks.launch).toHaveBeenCalledOnce()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(onCleanupError).toHaveBeenCalledOnce()
  })

  it('journals actual metadata and disconnects without sending a shared-host close command', async () => {
    launchOwned()
    const onResource = vi.fn(async () => {})
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'consumer', runtimeProvider: 'devtools', onResource })
    expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ cliPath: 'selected-stable-cli', launchMode: 'bridge', bridgeProjectMode: 'snapshot' }))
    await session.close()
    await session.close()
    expect(onResource).toHaveBeenLastCalledWith(expect.objectContaining({ projectPath: 'owned-snapshot-1', cliPath: 'selected-stable-cli', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415, managedProject: { id: 'confirmed-owner', journalPath: 'task-journal' }, status: 'closed', portClosed: true }))
    expect(mocks.closeProject).toHaveBeenCalledOnce()
    expect(mocks.waitForPortClosed).toHaveBeenCalledExactlyOnceWith(9415, '127.0.0.1')
  })

  it('closes registered snapshots when launch fails before returning a session', async () => {
    mocks.launch.mockImplementation(async (options) => {
      await options.onOwnedSnapshot({ projectPath: 'failed-snapshot', cliPath: options.cliPath })
      await options.onSessionMetadata({ projectPath: 'failed-snapshot', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415, managedProject: { id: 'confirmed-owner', journalPath: 'task-journal' } })
      throw new Error('bridge connect failed')
    })
    await expect(createRuntimeBenchSession({ log: () => {}, projectRoot: 'consumer', runtimeProvider: 'devtools' })).rejects.toThrow('bridge connect failed')
    expect(mocks.closeProject).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ projectPath: 'failed-snapshot', projectClosed: true }))
    expect(mocks.waitForPortClosed).toHaveBeenCalledExactlyOnceWith(9415, '127.0.0.1')
  })

  it('still releases ownership when the registration journal cannot be saved', async () => {
    launchOwned()
    const onResource = vi.fn(async () => {}).mockRejectedValueOnce(new Error('evidence disk full'))
    await expect(createRuntimeBenchSession({ log: () => {}, projectRoot: 'consumer', runtimeProvider: 'devtools', onResource })).rejects.toThrow('evidence disk full')
    expect(mocks.closeProject).not.toHaveBeenCalled()
    expect(mocks.waitForPortClosed).not.toHaveBeenCalled()
  })

  it('does not claim ownership from a returned session pointing to a manual project', async () => {
    const close = vi.fn()
    const disconnect = vi.fn()
    mocks.launch.mockResolvedValue({ close, disconnect, __WEAPP_VITE_SESSION_METADATA: { projectPath: 'manual-project', wsEndpoint: 'ws://127.0.0.1:9415', port: 9415, managedProject: { id: 'confirmed-owner', journalPath: 'task-journal' } } })
    await expect(createRuntimeBenchSession({ log: () => {}, projectRoot: 'consumer', runtimeProvider: 'devtools' })).rejects.toThrow('not an owned snapshot')
    expect(disconnect).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    expect(mocks.closeProject).not.toHaveBeenCalled()
    expect(mocks.waitForPortClosed).not.toHaveBeenCalled()
  })

  it('preserves the headless session close contract without claiming DevTools resources', async () => {
    const close = vi.fn()
    mocks.launch.mockResolvedValue({ close })
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'consumer', runtimeProvider: 'headless' })
    await session.close()
    expect(close).toHaveBeenCalledOnce()
    expect(mocks.closeProject).not.toHaveBeenCalled()
  })
})
