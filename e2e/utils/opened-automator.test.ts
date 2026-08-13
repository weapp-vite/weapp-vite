import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForOpenedAutomator } from './opened-automator'

const connectOpenedAutomatorMock = vi.hoisted(() => vi.fn())
const resolveProjectAutomatorPortMock = vi.hoisted(() => vi.fn(() => 11074))

vi.mock('weapp-ide-cli', () => ({
  connectOpenedAutomator: connectOpenedAutomatorMock,
  resolveProjectAutomatorPort: resolveProjectAutomatorPortMock,
}))

describe('opened automator', () => {
  beforeEach(() => {
    connectOpenedAutomatorMock.mockReset()
    resolveProjectAutomatorPortMock.mockReset()
    resolveProjectAutomatorPortMock.mockReturnValue(11074)
  })

  it('waits for a readable current page before returning an opened session', async () => {
    const miniProgram = {
      currentPage: vi.fn(),
    }
    connectOpenedAutomatorMock.mockResolvedValueOnce(miniProgram)

    const session = await waitForOpenedAutomator('/workspace/project', {
      appReadyTimeoutMs: 17,
      connectTimeoutMs: 5,
      intervalMs: 1,
      timeoutMs: 50,
    })

    expect(session.miniProgram).toBe(miniProgram)
    expect(session.metadata).toMatchObject({
      projectPath: '/workspace/project',
      wsEndpoint: 'ws://127.0.0.1:11074',
    })
    expect(miniProgram.currentPage).toHaveBeenCalledWith({
      retries: 1,
      timeout: 17,
    })
  })

  it('uses the expected route as the readiness probe when provided', async () => {
    const miniProgram = {
      currentPage: vi.fn(),
      reLaunch: vi.fn(),
    }
    connectOpenedAutomatorMock.mockResolvedValueOnce(miniProgram)

    await waitForOpenedAutomator('/workspace/project', {
      appReadyTimeoutMs: 17,
      connectTimeoutMs: 5,
      intervalMs: 1,
      readyRoute: '/pages/index/index',
      timeoutMs: 50,
    })

    expect(miniProgram.reLaunch).toHaveBeenCalledWith('/pages/index/index')
    expect(miniProgram.currentPage).not.toHaveBeenCalled()
  })

  it('retries when an opened session closes before the page is readable', async () => {
    const staleMiniProgram = {
      currentPage: vi.fn(async () => {
        throw new Error('Connection closed, check if wechat web devTools is still running')
      }),
      disconnect: vi.fn(),
    }
    const readyMiniProgram = {
      currentPage: vi.fn(),
    }
    connectOpenedAutomatorMock
      .mockResolvedValueOnce(staleMiniProgram)
      .mockResolvedValueOnce(readyMiniProgram)

    const session = await waitForOpenedAutomator('/workspace/project', {
      appReadyTimeoutMs: 7,
      connectTimeoutMs: 5,
      intervalMs: 1,
      timeoutMs: 50,
    })

    expect(session.miniProgram).toBe(readyMiniProgram)
    expect(staleMiniProgram.disconnect).toHaveBeenCalledTimes(1)
    expect(connectOpenedAutomatorMock).toHaveBeenCalledTimes(2)
  })
})
