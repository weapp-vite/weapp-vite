/**
 * @file 协议连接测试。
 */
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const webSocketInstances = vi.hoisted(() => [] as Array<EventEmitter & {
  terminate: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  url: string
}>)

vi.mock('./internal/compat', () => ({
  dateFormat: () => '2026-03-30 00:00:00:000',
  stringify: JSON.stringify,
  uuid: () => 'fixed-id',
}))

vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events')
  function MockWebSocket(this: EventEmitter & {
    terminate: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    url: string
  }, url: string) {
    this.url = url
    this.close = vi.fn()
    this.terminate = vi.fn()
    webSocketInstances.push(this)
  }
  MockWebSocket.prototype = Object.create(EventEmitter.prototype)
  MockWebSocket.prototype.constructor = MockWebSocket
  return {
    default: MockWebSocket,
  }
})

class FakeTransport extends EventEmitter {
  send = vi.fn()
  close = vi.fn()
}

describe('Connection', () => {
  beforeEach(() => {
    vi.resetModules()
    webSocketInstances.length = 0
  })

  it('sends protocol payloads and resolves matching responses', async () => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)

    const pending = connection.send('Page.getData', { pageId: 1 })
    expect(transport.send).toHaveBeenCalledWith(JSON.stringify({
      id: 'fixed-id',
      method: 'Page.getData',
      params: { pageId: 1 },
    }))

    transport.emit('message', JSON.stringify({
      id: 'fixed-id',
      result: { data: { ok: true } },
    }))

    await expect(pending).resolves.toEqual({ data: { ok: true } })
  })

  it.each([
    ['2.01.2510290', true, true],
    ['2.02.2608070', false, true],
    ['2.02.2608080', false, true],
    ['2.02.2609231', false, true],
    ['2.02.2610082', false, true],
    ['2.02.2610092', false, true],
    ['2.01.2601010', false, false],
  ] as const)('selects only affected Page protocols for DevTools %s', async (version, pageProtocol, methodProtocol) => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)

    connection.configureToolInfo({ version })
    expect(connection.prefersAppServicePageProtocol).toBe(pageProtocol)
    expect(connection.prefersAppServicePageMethod).toBe(methodProtocol)

    connection.configureToolInfo({ version: 'unknown' })
    expect(connection.prefersAppServicePageProtocol).toBe(false)
    expect(connection.prefersAppServicePageMethod).toBe(false)
  })

  it('rejects protocol errors and pending callbacks on close', async () => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)

    const errored = connection.send('App.exit')
    transport.emit('message', JSON.stringify({
      id: 'fixed-id',
      error: { message: 'boom' },
    }))
    await expect(errored).rejects.toThrow('boom')

    const pending = connection.send('Tool.close')
    transport.emit('close')
    await expect(pending).rejects.toThrow('Connection closed')
  })

  it.each(['2.02.2608080', '2.02.2610082'])('reads async method results through AppService while keeping element queries native in %s', async (version) => {
    const { default: Connection } = await import('./Connection')
    const { default: Page } = await import('./Page')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)
    connection.configureToolInfo({ version })
    const page = new Page(connection, { id: 1, path: 'pages/index/index', query: {} })
    const state = { readyMarker: 'vue-index-ready', metrics: { loadToReadyMs: 12 } }
    const result = page.callMethod('readBenchState')
    expect(JSON.parse(transport.send.mock.calls.at(-1)![0]).method).toBe('App.callFunction')
    transport.emit('message', JSON.stringify({ id: 'fixed-id', result: { result: { __weappVitePageMethodFound: true, status: 'fulfilled', value: state } } }))
    await expect(result).resolves.toEqual(state)

    const elements = page.$$('.inside-component')
    expect(JSON.parse(transport.send.mock.calls.at(-1)![0])).toMatchObject({ method: 'Page.getElements', params: { pageId: 1, selector: '.inside-component' } })
    transport.emit('message', JSON.stringify({ id: 'fixed-id', result: { elements: [] } }))
    await expect(elements).resolves.toEqual([])
    connection.dispose()
  })

  it('rejects requests that never receive a protocol response', async () => {
    vi.useFakeTimers()
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)

    const pending = connection.send('App.getCurrentPage')
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
      method: 'App.getCurrentPage',
    })

    await vi.advanceTimersByTimeAsync(30_000)
    await assertion

    vi.useRealTimers()
  })

  it('supports request scoped protocol timeouts', async () => {
    vi.useFakeTimers()
    try {
      const { default: Connection } = await import('./Connection')
      const transport = new FakeTransport()
      const connection = new Connection(transport as any)

      const pending = connection.send('App.getCurrentPage', {}, { timeout: 1_000 })
      const assertion = expect(pending).rejects.toMatchObject({
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.getCurrentPage',
      })

      await vi.runOnlyPendingTimersAsync()
      await assertion

      transport.emit('message', JSON.stringify({
        id: 'fixed-id',
        result: { pageId: 1 },
      }))
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('rejects websocket connections that never open', async () => {
    vi.useFakeTimers()
    try {
      const { default: Connection } = await import('./Connection')

      const pending = Connection.create('ws://127.0.0.1:1234', 1_000)
      const assertion = expect(pending).rejects.toThrow('Timed out connecting to DevTools websocket ws://127.0.0.1:1234 after 1000ms')

      await vi.advanceTimersByTimeAsync(1_000)
      await assertion
      expect(webSocketInstances[0]?.terminate).toHaveBeenCalledTimes(1)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('aborts a handshake, preserves its cause and ignores late socket events', async () => {
    const { default: Connection } = await import('./Connection')
    const controller = new AbortController()
    const cause = new Error('caller canceled')
    const result = Connection.create('ws://127.0.0.1:1234', 1_000, controller.signal)
    const assertion = expect(result).rejects.toBe(cause)
    controller.abort(cause)
    await assertion
    const socket = webSocketInstances[0]!
    expect(socket.terminate).toHaveBeenCalledOnce()
    socket.emit('open')
    socket.emit('error', new Error('late error'))
    expect(socket.listenerCount('open')).toBe(0)
    expect(socket.terminate).toHaveBeenCalledOnce()
  })

  it('does not open a websocket when the caller is already canceled', async () => {
    const { default: Connection } = await import('./Connection')
    const controller = new AbortController()
    controller.abort(new Error('canceled'))
    expect(() => Connection.create('ws://127.0.0.1:1234', 1_000, controller.signal)).toThrow('canceled')
    expect(webSocketInstances).toHaveLength(0)
  })

  it('disposes pending protocol work and transport exactly once', async () => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)
    const result = connection.send('Tool.getInfo')
    const assertion = expect(result).rejects.toThrow('Connection closed')
    connection.dispose()
    connection.dispose()
    await assertion
    expect(transport.close).toHaveBeenCalledOnce()
    expect(transport.listenerCount('message')).toBe(0)
    await expect(connection.send('App.getCurrentPage')).rejects.toThrow('Connection closed')
    expect(transport.send).toHaveBeenCalledOnce()
  })

  it('emits protocol events without request ids', async () => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)
    const onConsole = vi.fn()
    connection.on('App.logAdded', onConsole)

    transport.emit('message', JSON.stringify({
      method: 'App.logAdded',
      params: { level: 'info' },
    }))

    expect(onConsole).toHaveBeenCalledWith({ level: 'info' })
  })

  it('disposes the transport directly', async () => {
    const { default: Connection } = await import('./Connection')
    const transport = new FakeTransport()
    const connection = new Connection(transport as any)

    connection.dispose()

    expect(transport.close).toHaveBeenCalledTimes(1)
  })
})
