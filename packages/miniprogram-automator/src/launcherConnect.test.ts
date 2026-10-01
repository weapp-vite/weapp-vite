import type Transport from './Transport'
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Connection from './Connection'
import Launcher from './Launcher'
import MiniProgram from './MiniProgram'

function createTransport(sdkVersion?: string) {
  const transport = Object.assign(new EventEmitter(), {
    send: vi.fn((payload: string) => {
      if (sdkVersion !== undefined) {
        const request = JSON.parse(payload) as { id: string }
        queueMicrotask(() => transport.emit('message', JSON.stringify({ id: request.id, result: { SDKVersion: sdkVersion } })))
      }
    }),
    close: vi.fn(() => transport.emit('close')),
  })
  return transport
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Launcher connect ownership', () => {
  it('shares the timeout between websocket creation and the version probe, disposing before rejection', async () => {
    vi.useFakeTimers()
    const transport = createTransport()
    vi.spyOn(Connection, 'create').mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 60))
      return new Connection(transport as unknown as Transport)
    })
    const startedAt = performance.now()
    const result = new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1', timeout: 100 }).then(() => ({ error: undefined, elapsed: performance.now() - startedAt }), error => ({ error, elapsed: performance.now() - startedAt }))
    await vi.advanceTimersByTimeAsync(100)
    const closedAtDeadline = transport.close.mock.calls.length
    await vi.runAllTimersAsync()
    const outcome = await result
    expect(outcome.error).toMatchObject({ code: 'DEVTOOLS_OPERATION_TIMEOUT', operation: { stage: 'version', remainingMs: 0 } })
    expect(outcome.elapsed).toBe(100)
    expect(closedAtDeadline).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not probe or retain a connection returned after the whole budget elapsed', async () => {
    vi.useFakeTimers()
    const transport = createTransport('dev')
    vi.spyOn(Connection, 'create').mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return new Connection(transport as unknown as Transport)
    })
    const result = new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1', timeout: 100 }).catch(error => error)
    await vi.advanceTimersByTimeAsync(100)
    await expect(result).resolves.toMatchObject({ code: 'DEVTOOLS_OPERATION_TIMEOUT', operation: { stage: 'websocket' } })
    expect(transport.send).not.toHaveBeenCalled()
    expect(transport.close).toHaveBeenCalledOnce()
  })

  it('disconnects an incompatible SDK without shutting down the IDE project', async () => {
    const transport = createTransport('2.0.0')
    vi.spyOn(Connection, 'create').mockResolvedValueOnce(new Connection(transport as unknown as Transport))
    await expect(new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1' })).rejects.toThrow('requires at least version')
    expect(transport.close).toHaveBeenCalledOnce()
    expect(transport.send.mock.calls.map(([payload]) => (JSON.parse(payload) as { method: string }).method)).toEqual(['Tool.getInfo'])
  })

  it('preserves the original websocket failure as cause', async () => {
    const cause = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
    vi.spyOn(Connection, 'create').mockRejectedValueOnce(cause)
    await expect(new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1' })).rejects.toMatchObject({ cause })
  })

  it('bounds an uncooperative version probe and disconnects only its own session', async () => {
    vi.useFakeTimers()
    const transport = createTransport('dev')
    vi.spyOn(Connection, 'create').mockResolvedValueOnce(new Connection(transport as unknown as Transport))
    vi.spyOn(MiniProgram.prototype, 'checkVersion').mockImplementation(() => new Promise(() => {}))
    let settled = false
    const result = new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1', timeout: 100 }).catch((error) => {
      settled = true
      return error
    })
    await vi.advanceTimersByTimeAsync(100)
    expect(settled).toBe(true)
    expect(transport.close).toHaveBeenCalledOnce()
    await expect(result).resolves.toBeInstanceOf(Error)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('transfers a successful connection to the caller', async () => {
    const transport = createTransport('dev')
    vi.spyOn(Connection, 'create').mockResolvedValueOnce(new Connection(transport as unknown as Transport))
    const session = await new Launcher().connect({ wsEndpoint: 'ws://127.0.0.1:1', timeout: 100 })
    if (!(session instanceof MiniProgram)) {
      throw new TypeError('Expected a WeChat automator session')
    }
    expect(transport.close).not.toHaveBeenCalled()
    session.disconnect()
    expect(transport.close).toHaveBeenCalledOnce()
  })
})
