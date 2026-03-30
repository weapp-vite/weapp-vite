/**
 * @file 协议连接测试。
 */
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./internal/compat', () => ({
  dateFormat: () => '2026-03-30 00:00:00:000',
  stringify: JSON.stringify,
  uuid: () => 'fixed-id',
}))

class FakeTransport extends EventEmitter {
  send = vi.fn()
  close = vi.fn()
}

describe('Connection', () => {
  beforeEach(() => {
    vi.resetModules()
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
