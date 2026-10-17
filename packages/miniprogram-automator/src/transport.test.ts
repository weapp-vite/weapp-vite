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

  it('shares pending disposal and confirms socket closure before resolving', async () => {
    const ws = new FakeWebSocket()
    const transport = new Transport(ws as any)
    const closing = transport.close()
    expect(closing).toBeInstanceOf(Promise)
    expect(transport.close()).toBe(closing)
    let finished = false
    void closing.then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    ws.emit('close')
    await closing
    expect(finished).toBe(true)
    expect(ws.terminate).toHaveBeenCalledOnce()
    await transport.close()
  })

  it('bounds missing close acknowledgements and permits confirmation after a late close', async () => {
    vi.useFakeTimers()
    try {
      const ws = new FakeWebSocket()
      const transport = new Transport(ws as any)
      const failure = expect(transport.close()).rejects.toMatchObject({ code: 'DEVTOOLS_DISCONNECT_TIMEOUT' })
      await vi.advanceTimersByTimeAsync(2_000)
      await failure
      expect(vi.getTimerCount()).toBe(0)
      ws.emit('close')
      await transport.close()
      expect(ws.terminate).toHaveBeenCalledOnce()
    }
    finally {
      vi.useRealTimers()
    }
  })
})
