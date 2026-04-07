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
  extractPluginId: vi.fn((value: string) => value.match(/^plugin-private:\/\/([^/]+)/)?.[1] || ''),
  isPluginPath: vi.fn((value: string) => value.startsWith('plugin-private://')),
  printQrCode: vi.fn(async () => {}),
}))

class FakeConnection extends EventEmitter {
  send = vi.fn<(method: string, params?: Record<string, any>) => Promise<any>>(async () => ({}))
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

  it('checks sdk version compatibility', async () => {
    const connection = new FakeConnection()
    const miniProgram = new MiniProgram(connection as any)

    connection.send.mockResolvedValueOnce({ SDKVersion: '2.7.2' })
    await expect(miniProgram.checkVersion()).rejects.toThrow('requires at least version 2.7.3')

    connection.send.mockResolvedValueOnce({ SDKVersion: 'dev' })
    await expect(miniProgram.checkVersion()).resolves.toBeUndefined()
  })

  it('switches route through plugin methods when current page is a plugin page', async () => {
    const connection = new FakeConnection()
    connection.send
      .mockResolvedValueOnce({ pageId: 1, path: 'plugin-private://plugin-a/pages/home', query: {} })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ pageId: 2, path: '/pages/after', query: {} })
    const miniProgram = new MiniProgram(connection as any)

    const pending = miniProgram.navigateTo('/pages/next')
    await vi.advanceTimersByTimeAsync(3000)
    const page = await pending

    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.callWxMethod', {
      method: 'navigateTo',
      pluginId: 'plugin-a',
      args: [{ url: '/pages/next' }],
    })
    expect(page.path).toBe('/pages/after')
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
