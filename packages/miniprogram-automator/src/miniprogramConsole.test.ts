import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

class ConsoleConnection extends EventEmitter {
  runtimeEnabled = false
  send = vi.fn(async (method: string, _params?: Record<string, unknown>, _options?: { timeout?: number }) => {
    if (method === 'App.CDPCommand') {
      this.runtimeEnabled = true
    }
    return {}
  })

  emitRuntimeConsole() {
    if (this.runtimeEnabled) {
      this.emit('App.logAdded', { type: 'log', args: ['console event'] })
    }
  }
}

describe('MiniProgram console domain initialization', () => {
  afterEach(() => vi.useRealTimers())

  it('enables the Runtime domain so console events do not depend on an open IDE Console panel', async () => {
    const connection = new ConsoleConnection()
    const miniProgram = new MiniProgram(connection as any)
    const listener = vi.fn()
    miniProgram.addListener('console', listener)
    await miniProgram.enableLog()
    connection.emitRuntimeConsole()
    expect(listener).toHaveBeenCalledWith({ type: 'log', args: ['console event'] })
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(['App.enableLog', 'App.CDPCommand'])
    expect(connection.send).toHaveBeenLastCalledWith('App.CDPCommand', { domain: 'Runtime', method: 'enable', params: {} })
  })

  it('shares concurrent initialization and does not initialize again when adding listeners', async () => {
    const connection = new ConsoleConnection()
    let complete: (() => void) | undefined
    connection.send.mockImplementationOnce(async () => await new Promise<Record<string, unknown>>((resolve) => {
      complete = () => resolve({})
    }))
    const miniProgram = new MiniProgram(connection as any)
    const first = miniProgram.enableLog()
    const second = miniProgram.enableLog()
    expect(first).toBe(second)
    complete!()
    await first
    miniProgram.on('console', vi.fn())
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(['App.enableLog', 'App.CDPCommand'])
  })

  it('keeps the legacy wrapper path only for the exact unsupported CDP command response', async () => {
    const connection = new ConsoleConnection()
    connection.send.mockImplementation(async (method) => {
      if (method === 'App.CDPCommand') {
        throw new Error('appservice App.CDPCommand unimplemented')
      }
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)
    await expect(miniProgram.enableLog()).resolves.toBeUndefined()
    miniProgram.on('console', vi.fn())
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(['App.enableLog', 'App.CDPCommand'])
  })

  it.each(['connection closed', 'protocol timeout', 'appservice App.otherCommand unimplemented'])('preserves %s and permits a later retry', async (message) => {
    const connection = new ConsoleConnection()
    const failure = new Error(message)
    connection.send.mockResolvedValueOnce({}).mockRejectedValueOnce(failure)
    const miniProgram = new MiniProgram(connection as any)
    await expect(miniProgram.enableLog()).rejects.toBe(failure)
    await expect(miniProgram.enableLog()).resolves.toBeUndefined()
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(['App.enableLog', 'App.CDPCommand', 'App.enableLog', 'App.CDPCommand'])
  })

  it('uses the remaining timeout for Runtime enable instead of doubling the caller budget', async () => {
    vi.useFakeTimers()
    const connection = new ConsoleConnection()
    connection.send.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 250))
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)
    const enabling = miniProgram.enableLog(1_000)
    await vi.advanceTimersByTimeAsync(250)
    await enabling
    expect(connection.send).toHaveBeenNthCalledWith(1, 'App.enableLog', {}, { timeout: 1_000 })
    expect(connection.send).toHaveBeenNthCalledWith(2, 'App.CDPCommand', { domain: 'Runtime', method: 'enable', params: {} }, { timeout: 750 })
  })

  it('reenables the Runtime domain on explicit refresh after an AppService restart', async () => {
    const connection = new ConsoleConnection()
    const miniProgram = new MiniProgram(connection as any)
    await miniProgram.enableLog()
    connection.runtimeEnabled = false
    await miniProgram.enableLog()
    expect(connection.runtimeEnabled).toBe(true)
    expect(connection.send).toHaveBeenCalledTimes(4)
  })

  it('does not issue another request after the initialization budget is exhausted', async () => {
    vi.useFakeTimers()
    const connection = new ConsoleConnection()
    connection.send.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 1_000))
      return {}
    })
    const miniProgram = new MiniProgram(connection as any)
    const result = expect(miniProgram.enableLog(1_000)).rejects.toThrow('Timed out enabling console logging within 1000ms')
    await vi.advanceTimersByTimeAsync(1_000)
    await result
    expect(connection.send).toHaveBeenCalledTimes(1)
    await expect(miniProgram.enableLog(1_000)).resolves.toBeUndefined()
    expect(connection.runtimeEnabled).toBe(true)
  })
})
