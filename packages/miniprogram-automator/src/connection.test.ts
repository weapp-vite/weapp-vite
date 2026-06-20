/**
 * @file 协议连接测试。
 */
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const webSocketInstances = vi.hoisted(() => [] as Array<EventEmitter & {
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
    close: ReturnType<typeof vi.fn>
    url: string
  }, url: string) {
    this.url = url
    this.close = vi.fn()
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
      expect(webSocketInstances[0]?.close).toHaveBeenCalledTimes(1)
    }
    finally {
      vi.useRealTimers()
    }
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
