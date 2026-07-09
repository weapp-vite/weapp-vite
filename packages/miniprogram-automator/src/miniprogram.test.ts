/**
 * @file 小程序对象测试。
 */
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import MiniProgram from './MiniProgram'
import Native from './Native'
import * as util from './util'

vi.mock('./util', () => ({
  decodeQrCode: vi.fn(async () => 'decoded-content'),
  extractPluginId: vi.fn((value: unknown) =>
    typeof value === 'string'
      ? value.match(/^plugin-private:\/\/([^/]+)/)?.[1] || ''
      : ''),
  isPluginPath: vi.fn((value: unknown) =>
    typeof value === 'string' && value.startsWith('plugin-private://')),
  printQrCode: vi.fn(async () => {}),
}))

class FakeConnection extends EventEmitter {
  send = vi.fn<(method: string, params?: Record<string, any>, options?: Record<string, any>) => Promise<any>>(async () => ({}))
  dispose = vi.fn()
}

describe('MiniProgram', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps page stack entries to cached page instances', async () => {
    const connection = new FakeConnection()
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getPageStack') {
        return {
          pageStack: [
            { pageId: 1, path: '/pages/index', query: { a: 1 } },
            { pageId: 1, path: '/pages/index', query: { a: 2 } },
          ],
        }
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pages = await miniProgram.pageStack()

    expect(pages).toHaveLength(2)
    expect(pages[0]).toBe(pages[1])
  })

  it('sends function declarations when mocking wx methods with callbacks', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)
    const handler = () => 'ok'

    await miniProgram.mockWxMethod('request', handler, 'arg-1')
    await miniProgram.mockPluginWxMethod('plugin-a', 'request', '() => 1')

    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.mockWxMethod', {
      method: 'request',
      functionDeclaration: handler.toString(),
      args: ['arg-1'],
    })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.mockWxMethod', {
      method: 'request',
      pluginId: 'plugin-a',
      functionDeclaration: '() => 1',
      args: [],
    })
  })

  it('enables console logging and dispatches exposed bindings safely', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)
    const onConsole = vi.fn()
    const binding = vi.fn()

    miniProgram.on('console', onConsole)
    await miniProgram.exposeFunction('bridge', binding)
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.enableLog', {})
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.addBinding', { name: 'bridge' })

    connection.emit('App.logAdded', { msg: 'hello' })
    connection.emit('App.bindingCalled', { name: 'bridge', args: ['payload'] })
    connection.emit('App.bindingCalled', { name: 'missing', args: ['noop'] })

    expect(onConsole).toHaveBeenCalledWith({ msg: 'hello' })
    expect(binding).toHaveBeenCalledWith('payload')
    await expect(miniProgram.exposeFunction('bridge', binding)).rejects.toThrow('already exists')
  })

  it('forwards scoped timeouts when evaluating app-service functions', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    connection.send.mockResolvedValueOnce({ result: 'ok' })

    await expect(miniProgram.evaluateWithOptions(() => 'ok', {
      timeout: 8_000,
    })).resolves.toBe('ok')

    expect(connection.send).toHaveBeenCalledWith('App.callFunction', {
      functionDeclaration: expect.stringContaining('ok'),
      args: [],
    }, {
      timeout: 8_000,
    })
  })

  it('keeps console listeners safe when enabling logs fails', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)
    const onConsole = vi.fn()

    connection.send.mockRejectedValueOnce(new Error('enable log timeout'))
    miniProgram.on('console', onConsole)
    await Promise.resolve()
    connection.emit('App.logAdded', { msg: 'hello' })

    expect(connection.send).toHaveBeenCalledWith('App.enableLog', {})
    expect(onConsole).toHaveBeenCalledWith({ msg: 'hello' })
  })

  it('exposes an awaitable console log enable hook', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    await miniProgram.enableLog()

    expect(connection.send).toHaveBeenCalledWith('App.enableLog', {})
  })

  it('checks sdk version compatibility', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    connection.send.mockResolvedValueOnce({ SDKVersion: '2.7.2' })
    await expect(miniProgram.checkVersion()).rejects.toThrow('requires at least version 2.7.3')

    connection.send.mockResolvedValueOnce({ SDKVersion: 'dev' })
    await expect(miniProgram.checkVersion()).resolves.toBeUndefined()
  })

  it('waits for App domain readiness before returning a launched session', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.captureScreenshot within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.captureScreenshot',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({ data: 'base64-data' })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.waitForAppReady()
    await vi.advanceTimersByTimeAsync(600)

    await expect(pending).resolves.toBeUndefined()
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.captureScreenshot', {}, {
      timeout: 3_000,
    })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.captureScreenshot', {}, {
      timeout: 3_000,
    })
  })

  it('forwards request scoped timeout when taking screenshots', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    connection.send.mockResolvedValueOnce({ data: 'base64-data' })
    await expect(miniProgram.screenshot({ timeout: 12_000 })).resolves.toBe('base64-data')

    expect(connection.send).toHaveBeenCalledWith('App.captureScreenshot', {}, {
      timeout: 12_000,
    })
  })

  it('retries recoverable screenshot capture failures', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    connection.send
      .mockRejectedValueOnce(new Error('fail to capture screenshot'))
      .mockResolvedValueOnce({ data: 'base64-data' })

    const pending = miniProgram.screenshot({ timeout: 12_000 })
    await vi.advanceTimersByTimeAsync(600)

    await expect(pending).resolves.toBe('base64-data')
    expect(connection.send).toHaveBeenCalledTimes(2)
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.captureScreenshot', {}, {
      timeout: 12_000,
    })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.captureScreenshot', {}, {
      timeout: 12_000,
    })
  })

  it('forwards raw Tool domain commands through tool()', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    await miniProgram.tool('compile', { force: true })

    expect(connection.send).toHaveBeenCalledWith('Tool.compile', { force: true })
  })

  it('provides typed Tool domain helpers', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    await miniProgram.compile({ force: true })
    await miniProgram.clearCache({ clean: 'compile' })
    await miniProgram.toolInfo()

    expect(connection.send).toHaveBeenNthCalledWith(1, 'Tool.compile', { force: true })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'Tool.clearCache', { clean: 'compile' })
    expect(connection.send).toHaveBeenNthCalledWith(3, 'Tool.getInfo', {})
  })

  it('switches route through plugin methods when current page is a plugin page', async () => {
    const connection = new FakeConnection()
    connection.send
      .mockResolvedValueOnce({ pageId: 1, path: 'plugin-private://plugin-a/pages/home', query: {} })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ pageId: 2, path: '/pages/next', query: {} })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.navigateTo('/pages/next')
    await vi.advanceTimersByTimeAsync(600)
    const page = await pending

    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.callWxMethod', {
      method: 'navigateTo',
      pluginId: 'plugin-a',
      args: [{ url: '/pages/next' }],
    })
    expect(page.path).toBe('/pages/next')
  })

  it('waits for the target route after route changes instead of reading currentPage only once', async () => {
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        return currentPageReads >= 3
          ? { pageId: 2, path: '/pages/next', query: {} }
          : { pageId: 1, path: '/pages/index', query: {} }
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
    expect(currentPageReads).toBeGreaterThanOrEqual(3)
  })

  it('keeps host route changes when DevTools returns a current page without path', async () => {
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        return currentPageReads >= 2
          ? { pageId: 2, path: '/pages/next', query: {} }
          : { pageId: 1, path: undefined, query: {} }
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(600)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(util.isPluginPath).toHaveBeenCalledWith('')
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
  })

  it('continues route polling when DevTools page meta is missing during route calls', async () => {
    const pageMetaError = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        return currentPageReads >= 2
          ? { pageId: 2, path: '/pages/next', query: {} }
          : { pageId: 1, path: '/pages/index', query: {} }
      }
      if (method === 'App.callWxMethod') {
        throw pageMetaError
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(600)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
  })

  it('retries currentPage when App.getCurrentPage times out transiently', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({ pageId: 7, path: '/pages/recovered', query: { ok: 1 } })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(400)
    const page = await pending

    expect(connection.send).toHaveBeenCalledTimes(2)
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.getCurrentPage', {})
    expect(page.path).toBe('/pages/recovered')
  })

  it('falls back to pageStack when currentPage times out after retries', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        pageStack: [
          { pageId: 7, path: '/pages/fallback', query: { ok: 1 } },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(connection.send).toHaveBeenCalledTimes(4)
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(3, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(4, 'App.getPageStack', {})
    expect(page.path).toBe('/pages/fallback')
  })

  it('falls back to pageStack when currentPage keeps timing out after retries', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        pageStack: [
          { pageId: 7, path: '/pages/fallback', query: { ok: 1 } },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(3, 'App.getCurrentPage', {})
    expect(connection.send).toHaveBeenNthCalledWith(4, 'App.getPageStack', {})
    expect(page.path).toBe('/pages/fallback')
  })

  it('falls back to app-service getCurrentPages when currentPage and pageStack time out', async () => {
    const currentPageTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const pageStackTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getPageStack within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getPageStack',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(pageStackTimeoutError)
      .mockResolvedValueOnce({
        result: [
          { __wxWebviewId__: 9, options: { ok: 1 }, route: 'pages/app-function-fallback' },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(page.path).toBe('pages/app-function-fallback')
    expect(page.query).toEqual({ ok: 1 })
    expect(connection.send).toHaveBeenNthCalledWith(5, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: [],
    }, {
      timeout: 15_000,
    })
  })

  it('falls back to app-service getCurrentPages when DevTools page meta is missing', async () => {
    const pageMetaError = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(pageMetaError)
      .mockRejectedValueOnce(pageMetaError)
      .mockRejectedValueOnce(pageMetaError)
      .mockRejectedValueOnce(pageMetaError)
      .mockResolvedValueOnce({
        result: [
          { __wxWebviewId__: 11, options: { ok: 1 }, route: 'pages/app-function-page-meta-fallback' },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(page.path).toBe('pages/app-function-page-meta-fallback')
    expect(page.query).toEqual({ ok: 1 })
    expect(connection.send).toHaveBeenNthCalledWith(4, 'App.getPageStack', {})
    expect(connection.send).toHaveBeenNthCalledWith(5, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: [],
    }, {
      timeout: 15_000,
    })
  })

  it('falls back to app-service getCurrentPages when DevTools current frame times out', async () => {
    const currentFrameError = new Error('[loader] unexpected current frame status timedout')
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(currentFrameError)
      .mockRejectedValueOnce(currentFrameError)
      .mockRejectedValueOnce(currentFrameError)
      .mockRejectedValueOnce(currentFrameError)
      .mockResolvedValueOnce({
        result: [
          { __wxWebviewId__: 13, options: { ok: 1 }, route: 'pages/current-frame-fallback' },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(page.path).toBe('pages/current-frame-fallback')
    expect(page.query).toEqual({ ok: 1 })
    expect(connection.send).toHaveBeenNthCalledWith(4, 'App.getPageStack', {})
    expect(connection.send).toHaveBeenNthCalledWith(5, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: [],
    }, {
      timeout: 15_000,
    })
  })

  it('retries app-service page stack fallback when App.callFunction times out transiently', async () => {
    const currentPageTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const pageStackTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getPageStack within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getPageStack',
      },
    )
    const callFunctionTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.callFunction within 15000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callFunction',
      },
    )
    const connection = new FakeConnection()
    connection.send
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(currentPageTimeoutError)
      .mockRejectedValueOnce(pageStackTimeoutError)
      .mockRejectedValueOnce(callFunctionTimeoutError)
      .mockResolvedValueOnce({
        result: [
          { __wxWebviewId__: 12, options: { ok: 1 }, route: 'pages/app-function-retry-fallback' },
        ],
      })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.currentPage()
    await vi.advanceTimersByTimeAsync(2_000)
    const page = await pending

    expect(page.path).toBe('pages/app-function-retry-fallback')
    expect(connection.send).toHaveBeenNthCalledWith(5, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: [],
    }, {
      timeout: 15_000,
    })
    expect(connection.send).toHaveBeenNthCalledWith(6, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: [],
    }, {
      timeout: 15_000,
    })
  })

  it('returns a target page handle without app-service fallback when route polling metadata times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        if (currentPageReads === 1) {
          return { pageId: 1, path: '/pages/index', query: {} }
        }
        throw timeoutError
      }
      if (method === 'App.callWxMethod') {
        return {}
      }
      if (method === 'App.getPageStack') {
        return {
          pageStack: [
            { pageId: 2, path: '/pages/next', query: {} },
          ],
        }
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(2_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).toHaveBeenCalledWith('App.getPageStack', {}, {
      timeout: 2_500,
    })
  })

  it('does not use app-service page stack while waiting for route changes', async () => {
    const currentPageTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const pageStackTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getPageStack within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getPageStack',
      },
    )
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        if (currentPageReads === 1) {
          return { pageId: 1, path: '/pages/index', query: {} }
        }
        throw currentPageTimeoutError
      }
      if (method === 'App.callWxMethod') {
        return {}
      }
      if (method === 'App.getPageStack') {
        throw pageStackTimeoutError
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(20_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(page.query).toEqual({})
    expect(connection.send).not.toHaveBeenCalledWith('App.callFunction', expect.anything(), expect.anything())
  })

  it('returns a target page handle when current frame stays unavailable during route polling', async () => {
    const currentFrameError = new Error('[loader] unexpected current frame status timedout')
    const connection = new FakeConnection()
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        throw currentFrameError
      }
      if (method === 'App.callWxMethod') {
        return {}
      }
      if (method === 'App.getPageStack') {
        throw currentFrameError
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next?tab=goods')
    await vi.advanceTimersByTimeAsync(20_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(page.query).toEqual({ tab: 'goods' })
  })

  it('returns a target page handle when route metadata stays unavailable after the route command', async () => {
    const currentPageTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const pageStackTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getPageStack within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getPageStack',
      },
    )
    const callFunctionTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.callFunction within 5000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callFunction',
      },
    )
    const connection = new FakeConnection()
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        throw currentPageTimeoutError
      }
      if (method === 'App.callWxMethod') {
        return {}
      }
      if (method === 'App.getPageStack') {
        throw pageStackTimeoutError
      }
      if (method === 'App.callFunction') {
        throw callFunctionTimeoutError
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next?tab=goods')
    await vi.advanceTimersByTimeAsync(20_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(page.query).toEqual({ tab: 'goods' })
  })

  it('continues host route changes when route context probing times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 30000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const connection = new FakeConnection()
    let routeChanged = false
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        if (!routeChanged) {
          throw timeoutError
        }
        return { pageId: 2, path: '/pages/next', query: {} }
      }
      if (method === 'App.getPageStack') {
        return new Promise(() => {})
      }
      if (method === 'App.callWxMethod') {
        routeChanged = true
        return {}
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(12_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
  })

  it('does not use app-service fallback before sending host route changes', async () => {
    const currentPageTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getCurrentPage within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      },
    )
    const pageStackTimeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method App.getPageStack within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getPageStack',
      },
    )
    const connection = new FakeConnection()
    let routeChanged = false
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        if (!routeChanged) {
          throw currentPageTimeoutError
        }
        return { pageId: 2, path: '/pages/next', query: {} }
      }
      if (method === 'App.getPageStack') {
        throw pageStackTimeoutError
      }
      if (method === 'App.callWxMethod') {
        routeChanged = true
        return {}
      }
      if (method === 'App.callFunction') {
        throw new Error('App.callFunction should not be used before route command')
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(1_200)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).not.toHaveBeenCalledWith('App.callFunction', expect.anything(), expect.anything())
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
  })

  it('keeps polling route context when currentPage is slower than the short protocol timeout', async () => {
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        return currentPageReads >= 4
          ? { pageId: 2, path: '/pages/next', query: {} }
          : { pageId: 1, path: '/pages/index', query: {} }
      }
      if (method === 'App.callWxMethod') {
        return {}
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(12_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(currentPageReads).toBeGreaterThanOrEqual(4)
  })

  it('waits for the target route when the route change command does not respond', async () => {
    const connection = new FakeConnection()
    let currentPageReads = 0
    connection.send.mockImplementation(async (method: string, _params?: Record<string, any>, options?: { timeout?: number }) => {
      if (method === 'App.getCurrentPage') {
        currentPageReads += 1
        return currentPageReads >= 3
          ? { pageId: 2, path: '/pages/next', query: {} }
          : { pageId: 1, path: '/pages/index', query: {} }
      }
      if (method === 'App.callWxMethod') {
        if (options?.timeout) {
          throw Object.assign(
            new Error(`DevTools did not respond to protocol method App.callWxMethod within ${options.timeout}ms`),
            {
              code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
              method: 'App.callWxMethod',
            },
          )
        }
        return {}
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.reLaunch('/pages/next')
    await vi.advanceTimersByTimeAsync(20_000)
    const page = await pending

    expect(page.path).toBe('/pages/next')
    expect(connection.send).toHaveBeenCalledWith('App.callWxMethod', {
      method: 'reLaunch',
      args: [{ url: '/pages/next' }],
    }, {
      timeout: 12_000,
    })
  })

  it('renders remote debug qr code and resolves after connection event', async () => {
    const connection = new FakeConnection()
    connection.send.mockResolvedValueOnce({ qrCode: 'encoded-base64' })
    const originalOnce = connection.once.bind(connection)
    vi.spyOn(connection, 'once').mockImplementation((event: string | symbol, listener: (...args: any[]) => void) => {
      const result = originalOnce(event, listener)
      if (event === 'Tool.onRemoteDebugConnected') {
        queueMicrotask(() => {
          connection.emit('Tool.onRemoteDebugConnected')
        })
      }
      return result
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.remote(true)
    await vi.advanceTimersByTimeAsync(1000)
    await pending

    expect(util.decodeQrCode).toHaveBeenCalledWith('encoded-base64')
    expect(util.printQrCode).toHaveBeenCalledWith('decoded-content')
  })

  it('caches native bridge instances and disposes the connection on disconnect', () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    const first = miniProgram.native()
    const second = miniProgram.native()
    miniProgram.disconnect()

    expect(first).toBeInstanceOf(Native)
    expect(first).toBe(second)
    expect(connection.dispose).toHaveBeenCalledTimes(1)
  })

  it('still disposes the connection when close steps never respond', async () => {
    const connection = new FakeConnection()
    connection.send.mockImplementation((method: string) => {
      if (method === 'App.exit' || method === 'Tool.close') {
        return new Promise(() => {})
      }
      return Promise.resolve({})
    })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.close()
    await vi.advanceTimersByTimeAsync(5000)
    await pending

    expect(connection.send).toHaveBeenCalledWith('App.exit', {})
    expect(connection.send).toHaveBeenCalledWith('Tool.close', {})
    expect(connection.dispose).toHaveBeenCalledTimes(1)
  })
})
