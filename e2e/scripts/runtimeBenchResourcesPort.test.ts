import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForBenchPortClosed } from './runtimeBench/resources'

const createConnection = vi.hoisted(() => vi.fn())
vi.mock('node:net', () => ({ default: { createConnection } }))

beforeEach(() => vi.resetAllMocks())

function connection(error?: string) {
  const socket = Object.assign(new EventEmitter(), { destroy: vi.fn(), setTimeout: vi.fn() })
  createConnection.mockImplementation(() => {
    queueMicrotask(() => {
      if (error) {
        socket.emit('error', Object.assign(new Error(error), { code: error }))
      }
      else {
        socket.emit('connect')
      }
    })
    return socket
  })
  return socket
}

describe('benchmark automator endpoint release', () => {
  it('accepts an explicit refused connection on the actual loopback address', async () => {
    const socket = connection('ECONNREFUSED')
    await expect(waitForBenchPortClosed(9415, '::1')).resolves.toBeUndefined()
    expect(createConnection).toHaveBeenCalledExactlyOnceWith({ port: 9415, host: '::1' })
    expect(socket.destroy).toHaveBeenCalledOnce()
  })

  it('rejects a still listening endpoint instead of declaring the host released', async () => {
    const socket = connection()
    await expect(waitForBenchPortClosed(9415, '127.0.0.1', 0)).rejects.toThrow('remained open')
    expect(socket.destroy).toHaveBeenCalledOnce()
  })

  it('does not interpret probe failures as proof that the endpoint is closed', async () => {
    const socket = connection('EACCES')
    await expect(waitForBenchPortClosed(9415)).rejects.toThrow('EACCES')
    expect(socket.destroy).toHaveBeenCalledOnce()
  })
})
