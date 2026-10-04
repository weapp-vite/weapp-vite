import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeBenchSession } from './runtimeBenchSession'

const mocks = vi.hoisted(() => ({ launch: vi.fn(), cleanup: vi.fn() }))
vi.mock('../utils/automator', () => ({ launchAutomator: mocks.launch, isLikelyRelaunchRetryableError: () => true }))
vi.mock('../utils/ide-devtools-cleanup', () => ({ cleanupResidualDevtoolsProcesses: mocks.cleanup }))

beforeEach(() => vi.clearAllMocks())

describe('runtime benchmark host ownership', () => {
  it('journals the failed attempt before launching its replacement session', async () => {
    const order: string[] = []
    mocks.launch.mockImplementation(async () => {
      order.push('launch')
      return { close: async () => {
        order.push('close')
      } }
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
    mocks.launch.mockResolvedValue({ close })
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'mock-project', runtimeProvider: 'devtools', onCleanupError })
    await expect(session.close()).rejects.toThrow('owned host did not close')
    await expect(session.close()).rejects.toThrow('owned host did not close')
    expect(close).toHaveBeenCalledOnce()
    expect(onCleanupError).toHaveBeenCalledWith(expect.objectContaining({ message: 'owned host did not close' }))
    expect(onCleanupError).toHaveBeenCalledOnce()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })

  it('does not recover or launch another host when the previous close fails', async () => {
    mocks.launch.mockResolvedValue({
      close: async () => {
        throw new Error('close rejected')
      },
    })
    const onCleanupError = vi.fn(async () => {})
    const session = await createRuntimeBenchSession({ log: () => {}, projectRoot: 'mock-project', runtimeProvider: 'devtools', onCleanupError })
    await expect(session.run('sample', async () => {
      throw new Error('sample timeout')
    })).rejects.toThrow('sample and session cleanup failed')
    expect(mocks.launch).toHaveBeenCalledOnce()
    expect(mocks.cleanup).not.toHaveBeenCalled()
    expect(onCleanupError).toHaveBeenCalledOnce()
  })
})
