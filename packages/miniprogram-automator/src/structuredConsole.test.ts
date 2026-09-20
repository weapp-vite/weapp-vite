import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import MiniProgram from './MiniProgram'

function createSession() {
  const connection = Object.assign(new EventEmitter(), {
    send: vi.fn(async (_method: string, _params: Record<string, any>, _options?: { timeout: number }): Promise<any> => ({})),
    dispose: vi.fn(),
  })
  const session = new MiniProgram(connection as any)
  const listener = vi.fn()
  session.addListener('console', listener)
  return { connection, session, listener }
}

function errorArg(objectId = 'error-object') {
  return { type: 'object', objectId, className: 'Error', description: 'Error', preview: { properties: [] } }
}

function emitConsole(connection: EventEmitter, args: unknown[], type = 'error') {
  connection.emit('App.CDPEvent', { domain: 'Runtime', event: 'consoleAPICalled', params: { type, args, timestamp: 0 } })
}

function descriptors(message = 'Behavior construction failed') {
  return {
    result: [
      { name: 'message', enumerable: false, value: { type: 'string', value: message } },
      { name: 'stack', enumerable: false, value: { type: 'string', value: `Error: ${message}\n    at register (app.js:1:1)` } },
    ],
  }
}

describe('structured console diagnostics', () => {
  it('collects startup Error data descriptors before enable resolves and ignores the lossy SDK duplicate', async () => {
    const { connection, session, listener } = createSession()
    let subscribed = false
    connection.send.mockImplementation(async (method, params) => {
      if (method === 'App.CDPEnable') {
        subscribed = true
        return {}
      }
      if (params.method === 'enable') {
        expect(subscribed).toBe(true)
        emitConsole(connection, [errorArg()])
        connection.emit('App.logAdded', { type: 'error', args: [{}] })
        return {}
      }
      return descriptors()
    })
    await session.enableLog(3_000, { structured: true })
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      type: 'error',
      timestamp: 0,
      args: [{ ...errorArg(), value: { name: 'Error', message: 'Behavior construction failed', stack: 'Error: Behavior construction failed\n    at register (app.js:1:1)' } }],
    })
    expect(connection.send).toHaveBeenCalledWith('App.CDPCommand', {
      domain: 'Runtime',
      method: 'getProperties',
      params: { objectId: 'error-object', ownProperties: true, accessorPropertiesOnly: false, generatePreview: false },
    }, { timeout: 1_000 })
    expect(connection.send.mock.calls.map(call => [call[0], call[1].method])).toEqual([
      ['App.CDPEnable', undefined],
      ['App.CDPCommand', 'enable'],
      ['App.CDPCommand', 'getProperties'],
    ])
  })

  it('leaves plain objects and primitives untouched without remote inspection', async () => {
    const { connection, session, listener } = createSession()
    await session.enableLog(undefined, { structured: true })
    const args = [{ type: 'object', className: 'Object', objectId: 'plain' }, { type: 'number', value: 42 }, { type: 'string', value: 'hello' }]
    emitConsole(connection, args, 'log')
    await session.flushConsole()
    expect(listener.mock.calls[0][0].args).toEqual(args)
    expect(listener.mock.calls[0][0].args[0]).toBe(args[0])
    expect(connection.send).toHaveBeenCalledTimes(2)
  })

  it('does not invoke accessor properties and recognizes Error subtypes', async () => {
    const { connection, session, listener } = createSession()
    await session.enableLog(undefined, { structured: true })
    connection.send.mockResolvedValue({ result: [
      { name: 'message', get: { objectId: 'getter' } },
      { name: 'stack', get: { objectId: 'getter' }, value: { value: 'not a data descriptor' } },
      { name: 'custom', value: { value: 'ignored' } },
    ] })
    emitConsole(connection, [{ ...errorArg(), className: 'TypeError' }])
    await session.flushConsole()
    expect(listener.mock.calls[0][0].args[0].value).toEqual({ name: 'TypeError' })
    expect(connection.send.mock.calls.map(call => call[1].method)).toEqual([undefined, 'enable', 'getProperties'])
  })

  it('preserves event order when Error property responses complete out of order', async () => {
    const { connection, session, listener } = createSession()
    await session.enableLog(undefined, { structured: true })
    let resolveFirst!: (value: unknown) => void
    connection.send.mockImplementationOnce(async () => new Promise(resolve => resolveFirst = resolve))
    connection.send.mockResolvedValue(descriptors('second'))
    emitConsole(connection, [errorArg('first')])
    emitConsole(connection, [errorArg('second')])
    emitConsole(connection, [{ type: 'string', value: 'third' }], 'log')
    await Promise.resolve()
    expect(listener).not.toHaveBeenCalled()
    resolveFirst(descriptors('first'))
    await session.flushConsole()
    expect(listener.mock.calls.map(call => call[0].args[0].value)).toEqual([
      expect.objectContaining({ message: 'first' }),
      expect.objectContaining({ message: 'second' }),
      'third',
    ])
  })

  it.each(['connection closed', 'protocol timeout', 'appservice App.otherCommand unimplemented'])('retains startup events when enable fails with %s', async (message) => {
    const { connection, session, listener } = createSession()
    const failure = new Error(message)
    connection.send.mockImplementation(async (_method, params) => {
      if (params.method === 'enable') {
        emitConsole(connection, [errorArg()])
        throw failure
      }
      return descriptors()
    })
    await expect(session.enableLog(undefined, { structured: true })).rejects.toBe(failure)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].args[0].value.message).toBe('Behavior construction failed')
    expect(connection.send.mock.calls.some(call => call[0] === 'App.enableLog')).toBe(false)
  })

  it('retains original Error and explicit inspection diagnostics on query failure', async () => {
    const { connection, session, listener } = createSession()
    await session.enableLog(undefined, { structured: true })
    connection.send.mockRejectedValue(new Error('getProperties timed out'))
    emitConsole(connection, [errorArg()])
    await session.flushConsole()
    expect(listener.mock.calls[0][0].args).toEqual([{ ...errorArg(), inspectionError: 'getProperties timed out' }])
  })

  it('flushes pending Error evidence synchronously on disconnect without a later duplicate', async () => {
    const { connection, session, listener } = createSession()
    await session.enableLog(undefined, { structured: true })
    let complete!: (value: unknown) => void
    connection.send.mockImplementationOnce(async () => new Promise(resolve => complete = resolve))
    emitConsole(connection, [errorArg()])
    session.disconnect()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].args[0].inspectionError).toContain('connection closed')
    complete(descriptors())
    await Promise.resolve()
    await Promise.resolve()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it.each(['App.CDPEnable', 'App.CDPCommand'])('falls back to legacy only for the exact unsupported %s response and retries structured on refresh', async (method) => {
    const { connection, session, listener } = createSession()
    if (method === 'App.CDPCommand') {
      connection.send.mockResolvedValueOnce({})
    }
    connection.send.mockRejectedValueOnce(new Error(`appservice ${method} unimplemented`))
    await session.enableLog(undefined, { structured: true })
    const legacy = { type: 'error', args: [{ existing: 'shape' }] }
    connection.emit('App.logAdded', legacy)
    expect(listener).toHaveBeenCalledExactlyOnceWith(legacy)
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(method === 'App.CDPEnable'
      ? ['App.CDPEnable', 'App.enableLog']
      : ['App.CDPEnable', 'App.CDPCommand', 'App.enableLog'])
    await session.enableLog()
    connection.emit('App.logAdded', legacy)
    emitConsole(connection, [{ type: 'string', value: 'fresh' }])
    await session.flushConsole()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not start Runtime or fall back when the event-channel handshake fails', async () => {
    const { connection, session } = createSession()
    connection.send.mockRejectedValueOnce(new Error('App.CDPEnable timeout'))
    await expect(session.enableLog(undefined, { structured: true })).rejects.toThrow('App.CDPEnable timeout')
    expect(connection.send.mock.calls.map(call => call[0])).toEqual(['App.CDPEnable'])
  })

  it('shares concurrent structured initialization and rejects an incompatible format change', async () => {
    const { session } = createSession()
    const first = session.enableLog(undefined, { structured: true })
    expect(session.enableLog()).toBe(first)
    await expect(session.enableLog(undefined, { structured: false })).rejects.toThrow('Cannot change console format')
    await first
  })
})
