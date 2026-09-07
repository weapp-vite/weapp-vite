import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appendIdeReportEvent } from './ideWarningReport'
import { waitForOpenedAutomator } from './opened-automator'

const connectOpenedAutomatorMock = vi.hoisted(() => vi.fn())
const resolveProjectAutomatorPortMock = vi.hoisted(() => vi.fn(() => 11074))

vi.mock('weapp-ide-cli', () => ({
  connectOpenedAutomator: connectOpenedAutomatorMock,
  resolveProjectAutomatorPort: resolveProjectAutomatorPortMock,
}))

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'apps/demo' }))

function createSession() {
  return Object.assign(new EventEmitter(), {
    currentPage: vi.fn(),
    close: vi.fn(async () => {}),
    disconnect: vi.fn(),
    enableLog: vi.fn(async () => {}),
  })
}

describe('opened automator', () => {
  beforeEach(() => {
    connectOpenedAutomatorMock.mockReset()
    resolveProjectAutomatorPortMock.mockReset()
    resolveProjectAutomatorPortMock.mockReturnValue(11074)
    vi.mocked(appendIdeReportEvent).mockClear()
  })

  it('waits for a readable current page before returning an opened session', async () => {
    const miniProgram = createSession()
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
    expect(miniProgram.enableLog).toHaveBeenCalledWith(17)
  })

  it('uses the expected route as the readiness probe when provided', async () => {
    const miniProgram = Object.assign(createSession(), {
      reLaunch: vi.fn(),
    })
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
    const staleMiniProgram = Object.assign(createSession(), {
      currentPage: vi.fn(async () => {
        throw new Error('Connection closed, check if wechat web devTools is still running')
      }),
    })
    const staleDisconnect = staleMiniProgram.disconnect
    const readyMiniProgram = createSession()
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
    expect(staleDisconnect).toHaveBeenCalledTimes(1)
    expect(staleMiniProgram.listenerCount('console')).toBe(0)
    expect(staleMiniProgram.listenerCount('exception')).toBe(0)
    expect(connectOpenedAutomatorMock).toHaveBeenCalledTimes(2)
  })

  it('journals errors emitted during subscription and readiness before returning the session', async () => {
    const miniProgram = createSession()
    miniProgram.enableLog.mockImplementation(async () => {
      miniProgram.emit('console', { type: 'error', args: [{}] })
    })
    miniProgram.currentPage.mockImplementation(async () => {
      miniProgram.emit('exception', { exceptionDetails: { text: 'startup exception' } })
    })
    connectOpenedAutomatorMock.mockResolvedValue(miniProgram)
    await waitForOpenedAutomator('/workspace/project', { timeoutMs: 50 })
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'runtime',
      level: 'error',
      text: '{"type":"error","args":[{}]}',
    }))
    expect(appendIdeReportEvent).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'exception',
      level: 'exception',
      text: 'startup exception',
    }))
    await miniProgram.close()
    expect(miniProgram.listenerCount('console')).toBe(0)
    expect(miniProgram.listenerCount('exception')).toBe(0)
  })

  it('rejects an unavailable log subscription even when app readiness is skipped', async () => {
    const miniProgram = createSession()
    const disconnect = miniProgram.disconnect
    miniProgram.enableLog.mockRejectedValue(new Error('App.enableLog unavailable'))
    connectOpenedAutomatorMock.mockResolvedValue(miniProgram)
    await expect(waitForOpenedAutomator('/workspace/project', {
      skipAppReady: true,
      timeoutMs: 5,
      intervalMs: 10,
    })).rejects.toThrow('runtime log subscription failed: App.enableLog unavailable')
    expect(miniProgram.currentPage).not.toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(miniProgram.listenerCount('console')).toBe(0)
    expect(miniProgram.listenerCount('exception')).toBe(0)
  })
})
