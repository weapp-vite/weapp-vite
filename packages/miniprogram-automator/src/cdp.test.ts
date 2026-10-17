import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

function fixture() {
  const connection = Object.assign(new EventEmitter(), {
    send: vi.fn<(method: string, params?: Record<string, unknown>, options?: { timeout?: number }) => Promise<any>>(async () => ({})),
    dispose: vi.fn(async () => {}),
  })
  return { connection, program: new MiniProgram(connection as any) }
}

afterEach(() => vi.useRealTimers())

describe('public CDP session', () => {
  it('shares enable across handles and concurrent commands while preserving raw responses', async () => {
    const { connection, program } = fixture()
    let resolveEnable!: (value: unknown) => void
    connection.send.mockImplementation(async (method) => {
      if (method === 'App.CDPEnable') {
        return await new Promise(resolve => resolveEnable = resolve)
      }
      return { raw: method }
    })
    const cdp = program.CDP()
    expect(program.CDP()).toBe(cdp)
    const enable = cdp.enable()
    expect(cdp.enable()).toBe(enable)
    const command = cdp.sendCommand('Runtime', 'enable', {})
    const protocol = cdp.listProtocol()
    expect(connection.send).toHaveBeenCalledTimes(1)
    resolveEnable({ enabled: true })
    await expect(enable).resolves.toEqual({ enabled: true })
    await expect(command).resolves.toEqual({ raw: 'App.CDPCommand' })
    await expect(protocol).resolves.toEqual({ raw: 'App.CDPListProtocol' })
    expect(connection.send).toHaveBeenCalledWith('App.CDPCommand', { domain: 'Runtime', method: 'enable', params: {} })
  })

  it('preserves an enable failure and retries on the same handle', async () => {
    const { connection, program } = fixture()
    const failure = new Error('CDP initialization failed')
    connection.send.mockRejectedValueOnce(failure)
    await expect(program.CDP().sendCommand('Runtime', 'enable', {})).rejects.toBe(failure)
    await expect(program.CDP().enable()).resolves.toEqual({})
    expect(connection.send).toHaveBeenCalledTimes(2)
  })

  it('dispatches raw events and removes only its own subscriptions', async () => {
    const { connection, program } = fixture()
    const external = vi.fn()
    const listener = vi.fn()
    const other = vi.fn()
    connection.on('App.CDPEvent', external)
    const unsubscribe = program.CDP().onEvent(listener)
    program.CDP().onEvent(other)
    const event = { domain: 'Runtime', event: 'consoleAPICalled', params: { args: [] } }
    connection.emit('App.CDPEvent', event)
    expect(listener).toHaveBeenCalledExactlyOnceWith(event.domain, event.event, event.params)
    unsubscribe()
    unsubscribe()
    connection.emit('App.CDPEvent', event)
    expect(listener).toHaveBeenCalledTimes(1)
    await program.disconnect()
    expect(connection.listenerCount('App.CDPEvent')).toBe(1)
    connection.emit('App.CDPEvent', event)
    expect(other).toHaveBeenCalledTimes(2)
    expect(external).toHaveBeenCalledTimes(3)
    await expect(program.CDP().enable()).rejects.toThrow('closed')
  })

  it('uses one explicit budget for enable and command', async () => {
    vi.useFakeTimers()
    const { connection, program } = fixture()
    connection.send.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 250))
      return {}
    })
    const pending = program.CDP().sendCommand('Runtime', 'enable', {}, { timeout: 1000 })
    await vi.advanceTimersByTimeAsync(250)
    await pending
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.CDPEnable', {}, { timeout: 1000 })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.CDPCommand', { domain: 'Runtime', method: 'enable', params: {} }, { timeout: 750 })
  })

  it('refreshes the shared channel when structured logging is explicitly reenabled', async () => {
    const { connection, program } = fixture()
    await program.CDP().enable()
    await program.enableLog(undefined, { structured: true })
    await program.CDP().enable()
    expect(connection.send.mock.calls.filter(([method]) => method === 'App.CDPEnable')).toHaveLength(2)
  })

  it('shares a connection across wrappers and merges logging with a pending enable', async () => {
    const { connection, program } = fixture()
    const other = new MiniProgram(connection as any)
    let resolveEnable!: (value: unknown) => void
    connection.send.mockImplementationOnce(() => new Promise(resolve => resolveEnable = resolve))
    const enable = program.CDP().enable()
    const logging = other.enableLog(undefined, { structured: true })
    expect(other.CDP()).toBe(program.CDP())
    expect(connection.send).toHaveBeenCalledTimes(1)
    resolveEnable({})
    await Promise.all([enable, logging])
    expect(connection.send.mock.calls.filter(([method]) => method === 'App.CDPEnable')).toHaveLength(1)
  })

  it('stops subscriptions after a remote close', async () => {
    const { connection, program } = fixture()
    const listener = vi.fn()
    program.CDP().onEvent(listener)
    connection.emit('close')
    connection.emit('App.CDPEvent', { domain: 'Runtime', event: 'consoleAPICalled', params: {} })
    expect(listener).not.toHaveBeenCalled()
    expect(connection.listenerCount('App.CDPEvent')).toBe(0)
    expect(connection.listenerCount('App.logAdded')).toBe(0)
    expect(connection.listenerCount('close')).toBe(0)
    await expect(program.CDP().enable()).rejects.toThrow('closed')
  })

  it('bounds a command joining another pending enable by its own timeout', async () => {
    vi.useFakeTimers()
    const { connection, program } = fixture()
    let resolveEnable!: (value: unknown) => void
    connection.send.mockImplementationOnce(() => new Promise(resolve => resolveEnable = resolve))
    const enable = program.CDP().enable()
    const command = program.CDP().sendCommand('Runtime', 'enable', {}, { timeout: 10 })
    const shortEnable = expect(program.CDP().enable({ timeout: 10 })).rejects.toThrow('within 10ms')
    const failed = expect(command).rejects.toThrow('within 10ms')
    await vi.advanceTimersByTimeAsync(10)
    await failed
    await shortEnable
    resolveEnable({})
    await enable
    expect(connection.send).toHaveBeenCalledTimes(1)
    await expect(program.CDP().enable({ timeout: -1 })).rejects.toBeInstanceOf(RangeError)
  })
})
