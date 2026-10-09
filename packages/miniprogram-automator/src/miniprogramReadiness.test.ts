import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Connection from './Connection'
import MiniProgram from './MiniProgram'

describe('MiniProgram bounded readiness probes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    'Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.',
    'timeout waiting for automator response',
  ])('preserves %s without issuing retry or fallback requests', async (message) => {
    const failure = new Error(message)
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockRejectedValue(failure),
    })
    const miniProgram = new MiniProgram(connection as any)
    await expect(miniProgram.currentPage({
      appFunctionFallback: false,
      pageStackFallback: false,
      retries: 1,
      timeout: 300,
    })).rejects.toBe(failure)
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 300 }],
    ])
  })

  it.each([
    null,
    undefined,
    {},
    { data: 'screenshot-response' },
    { pageId: 1 },
    { path: 'pages/index/index' },
    { pageId: -1, path: 'pages/index/index' },
    { pageId: Number.NaN, path: 'pages/index/index' },
    { pageId: Number.MAX_SAFE_INTEGER + 1, path: 'pages/index/index' },
    { pageId: 1.5, path: 'pages/index/index' },
    { pageId: '1', path: 'pages/index/index' },
    { pageId: 1, path: '  ' },
  ])('does not deliver a session for an unready payload %j', async (payload) => {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn()
        .mockResolvedValueOnce(payload)
        .mockResolvedValueOnce({ pageId: 1, path: 'pages/index/index' }),
    })
    const miniProgram = new MiniProgram(connection as any)
    let ready = false
    const pending = miniProgram.waitForAppReady(1_000).then(() => {
      ready = true
    })

    await vi.advanceTimersByTimeAsync(499)
    expect(ready).toBe(false)
    expect(connection.send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await pending

    expect(ready).toBe(true)
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 1_000 }],
      ['App.getCurrentPage', {}, { timeout: 500 }],
    ])
  })

  it.each([
    'pages/index/index',
    '/pages/index/index',
    'plugin-private://provider/pages/index',
    '__plugin__/provider/pages/index',
    'plugin://alias/page',
  ])('accepts a stable page id of zero and the native route %s', async (path) => {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockResolvedValue({ pageId: 0, path }),
    })

    await expect(new MiniProgram(connection as any).waitForAppReady()).resolves.toBeUndefined()
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 3_000 }],
    ])
  })

  it.each([
    'Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.',
    'timeout waiting for automator response',
    '[loader] unexpected current frame status timedout',
  ])('waits for page registration after %s within the same deadline', async (message) => {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({ pageId: 2, path: 'pages/index/index' }),
    })
    const pending = new MiniProgram(connection as any).waitForAppReady(750)

    await vi.advanceTimersByTimeAsync(500)
    await expect(pending).resolves.toBeUndefined()
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 750 }],
      ['App.getCurrentPage', {}, { timeout: 250 }],
    ])
  })

  it('exhausts the original deadline when no page is registered', async () => {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockResolvedValue({}),
    })
    const pending = new MiniProgram(connection as any).waitForAppReady(750)
    const result = expect(pending).rejects.toThrow('no ready page with a valid pageId and path')

    await vi.advanceTimersByTimeAsync(750)
    await result
    expect(connection.send.mock.calls).toEqual([
      ['App.getCurrentPage', {}, { timeout: 750 }],
      ['App.getCurrentPage', {}, { timeout: 250 }],
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves non-readiness errors without another request', async () => {
    const failure = new Error('unimplemented protocol method')
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn().mockRejectedValue(failure),
    })

    await expect(new MiniProgram(connection as any).waitForAppReady()).rejects.toBe(failure)
    expect(connection.send).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops readiness polling when the owned protocol connection is disposed', async () => {
    const transport = Object.assign(new EventEmitter(), { send: vi.fn(), close: vi.fn() })
    const connection = new Connection(transport as any)
    const pending = new MiniProgram(connection).waitForAppReady()
    const result = expect(pending).rejects.toThrow('Connection closed')

    connection.dispose()
    await result
    expect(transport.send).toHaveBeenCalledTimes(1)
    expect(transport.close).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
