/**
 * @file 传输层测试。
 */
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import Transport from './Transport'

class FakeWebSocket extends EventEmitter {
  send = vi.fn()
  close = vi.fn()
  terminate = vi.fn()
}

describe('Transport', () => {
  it('forwards websocket messages as transport events', async () => {
    const ws = new FakeWebSocket()
    const transport = new Transport(ws as any)
    const onMessage = vi.fn()
    transport.on('message', onMessage)

    ws.emit('message', 'payload')
    ws.emit('message', Buffer.from('buffer-payload'))

    expect(onMessage).toHaveBeenNthCalledWith(1, 'payload')
    expect(onMessage).toHaveBeenNthCalledWith(2, 'buffer-payload')
  })

  it('terminates the owned socket immediately instead of waiting for a close handshake', () => {
    const ws = new FakeWebSocket()
    const transport = new Transport(ws as any)
    const onClose = vi.fn()
    transport.on('close', onClose)

    transport.send('hello')
    transport.close()
    ws.emit('close')

    expect(ws.send).toHaveBeenCalledWith('hello')
    expect(ws.terminate).toHaveBeenCalledTimes(1)
    expect(ws.close).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
