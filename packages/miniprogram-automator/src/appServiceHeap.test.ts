import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

function fixture() {
  const connection = Object.assign(new EventEmitter(), { send: vi.fn<(...args: unknown[]) => Promise<unknown>>() })
  return { connection, miniProgram: new MiniProgram(connection as any) }
}

describe('AppService heap capability', () => {
  it('reads the AppService CDP heap with an explicit timeout and preserves a valid zero', async () => {
    const { connection, miniProgram } = fixture()
    connection.send.mockResolvedValueOnce({ usedSize: 0, totalSize: 128 })
    await expect(miniProgram.getAppServiceHeapUsage({ timeout: 700 })).resolves.toEqual({ status: 'available', source: 'appservice-cdp-runtime', usedSize: 0, totalSize: 128 })
    expect(connection.send).toHaveBeenCalledExactlyOnceWith('App.CDPCommand', { domain: 'Runtime', method: 'getHeapUsage', params: {} }, { timeout: 700 })
  })

  it.each([
    ['appservice App.CDPCommand unimplemented', 'protocol-unimplemented'],
    ['\'Runtime.getHeapUsage\' wasn\'t found', 'method-not-found'],
  ])('recognizes only the explicit unsupported response %s and probes again next time', async (message, reason) => {
    const { connection, miniProgram } = fixture()
    connection.send.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({ usedSize: 12, totalSize: 24 })
    await expect(miniProgram.getAppServiceHeapUsage()).resolves.toEqual({ status: 'unsupported', source: 'appservice-cdp-runtime', reason })
    await expect(miniProgram.getAppServiceHeapUsage()).resolves.toMatchObject({ status: 'available', usedSize: 12 })
  })

  it('recognizes the CDP method-not-found error without accepting an empty success', async () => {
    const { connection, miniProgram } = fixture()
    connection.send.mockResolvedValueOnce({ error: { code: -32601, message: 'Method not found' } })
    await expect(miniProgram.getAppServiceHeapUsage()).resolves.toMatchObject({ status: 'unsupported', reason: 'method-not-found' })
  })

  it.each([undefined, null, {}, [], { usedSize: 1 }, { usedSize: '1', totalSize: 2 }, { usedSize: -1, totalSize: 2 }, { usedSize: 3, totalSize: 2 }, { usedSize: Number.NaN, totalSize: 2 }, { usedSize: 1, totalSize: Number.POSITIVE_INFINITY }, { usedSize: 1, totalSize: 2, error: { code: -32603 } }])('rejects an unavailable or invalid heap result %#', async (response) => {
    const { connection, miniProgram } = fixture()
    connection.send.mockResolvedValueOnce(response)
    await expect(miniProgram.getAppServiceHeapUsage()).rejects.toThrow('Invalid AppService')
  })

  it.each(['Connection closed', 'DevTools did not respond to protocol method App.CDPCommand within 2500ms', 'appservice App.otherCommand unimplemented', 'Unknown runtime failure'])('preserves the actual failure %s', async (message) => {
    const { connection, miniProgram } = fixture()
    const failure = new Error(message)
    connection.send.mockRejectedValueOnce(failure)
    await expect(miniProgram.getAppServiceHeapUsage()).rejects.toBe(failure)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid timeout %s before issuing a request', async (timeout) => {
    const { connection, miniProgram } = fixture()
    await expect(miniProgram.getAppServiceHeapUsage({ timeout })).rejects.toThrow('finite and positive')
    expect(connection.send).not.toHaveBeenCalled()
  })
})
