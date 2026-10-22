import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Connection from '../Connection'
import { CustomElement } from '../Element'
import { stringify } from '../internal/compat'
import { cleanupComponentCallers, invokeComponentMethod } from './index'
import { createConnectionHarness } from './protocolTestHelpers'

describe('component caller protocol ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('getCurrentPages', () => [{ __wxWebviewId__: 3 }])
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('routes the affected CustomElement through one exact caller session', async () => {
    const harness = createConnectionHarness()
    const element = new CustomElement(harness.connection, { elementId: '97', nodeId: '97', pageId: 3, tagName: 'component' }, new Map())
    await expect(element.callMethod('mark', 'value')).resolves.toBe('component:value')
    expect(harness.caller.mark).toHaveBeenCalledExactlyOnceWith('value')
    const commands = harness.send.mock.calls.filter(([method]) => method === 'App.CDPCommand').map(([, payload]) => payload)
    const release = commands.filter(command => command.method === 'releaseObject')
    expect(release.map(command => command.params.objectId)).toEqual(['owned-1'])
    expect(commands.filter(command => command.method === 'callFunctionOn')).toEqual(expect.arrayContaining([
      expect.objectContaining({ params: expect.objectContaining({ objectId: 'owned-1', returnByValue: true }) }),
    ]))
    expect(commands.every(command => !command.params.silent && !command.params.awaitPromise)).toBe(true)
    expect(harness.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps unaffected CustomElement calls on the original native protocol', async () => {
    const send = vi.fn(async () => ({ result: 'native' }))
    const connection = { send, prefersComponentCallerBridge: false } as unknown as Connection
    const element = new CustomElement(connection, { elementId: '97', nodeId: '97', pageId: 3, tagName: 'component' }, new Map())
    await expect(element.callMethod('mark', 'value')).resolves.toBe('native')
    expect(send).toHaveBeenCalledExactlyOnceWith('Element.callMethod', { elementId: '97', nodeId: '97', pageId: 3, method: 'mark', args: ['value'] })
  })

  it('preserves original undefined, RegExp, Function and circular argument serialization', async () => {
    const harness = createConnectionHarness()
    const nested: Record<string, unknown> = {}
    nested.self = nested
    const input = { missing: undefined, pattern: /value/gi, callback() {}, nested }
    const args = [input, undefined]
    const original = JSON.parse(stringify({
      id: 'request-id',
      method: 'Element.callMethod',
      params: { method: 'mark', args, elementId: '97', pageId: 3, nodeId: '97' },
    })) as { params: { args: unknown[] } }
    await invokeComponentMethod(harness.connection, harness.target, 'mark', args)
    expect(harness.caller.mark).toHaveBeenCalledExactlyOnceWith(...original.params.args)
    expect(harness.caller.mark.mock.calls[0]![0]).toMatchObject({
      missing: null,
      pattern: '[RegExp /value/gi]',
      callback: expect.stringContaining('[Function '),
      nested: { self: '[Circular ~.params.args.0.nested]' },
    })
  })

  it('returns to native for the explicit glass-easel backend only after owned cleanup', async () => {
    const harness = createConnectionHarness()
    harness.environment.getAdapterPage.mockReturnValue({})
    const native = vi.fn(async () => {
      expect(harness.send.mock.calls.filter(([, payload]) => payload.method === 'releaseObject')).toHaveLength(1)
      expect(harness.bridge.addSubscribeListener).not.toHaveBeenCalled()
      return 'native-glass'
    })
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'], native)).resolves.toBe('native-glass')
    expect(native).toHaveBeenCalledOnce()
    expect(harness.caller.mark).not.toHaveBeenCalled()
  })

  it('serializes native-backend args only once through the original Connection serializer', async () => {
    const harness = createConnectionHarness()
    harness.environment.getAdapterPage.mockReturnValue({})
    const toJSON = vi.fn(() => ({ value: 'native' }))
    const args = [{ toJSON }]
    const native = vi.fn(async () => {
      stringify({ id: 'request-id', method: 'Element.callMethod', params: { method: 'mark', args } })
      return 'native'
    })
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', args, native)).resolves.toBe('native')
    expect(toJSON).toHaveBeenCalledOnce()
    expect(native).toHaveBeenCalledOnce()
    expect(harness.caller.mark).not.toHaveBeenCalled()
  })

  it.each(['undefined', 'object', 'promise', 'throw'] as const)('keeps native returnByValue %s behavior and a single business call', async (kind) => {
    const harness = createConnectionHarness()
    harness.caller.mark.mockImplementation(() => {
      if (kind === 'throw') {
        throw new Error('business failure')
      }
      return kind === 'undefined' ? undefined : kind === 'promise' ? Promise.resolve('not awaited') : { ok: true }
    })
    const invocation = invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])
    if (kind === 'throw') {
      await expect(invocation).rejects.toThrow('business failure')
    }
    else {
      await expect(invocation).resolves.toEqual(kind === 'undefined' ? undefined : kind === 'promise' ? {} : { ok: true })
    }
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    expect(harness.listeners.size).toBe(0)
  })

  it.each(['arm', 'resolve', 'disarm'] as const)('cleans %s failure without attempting any business or native retry', async (stage) => {
    const harness = createConnectionHarness()
    harness.fail(stage)
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])).rejects.toThrow('response lost')
    expect(harness.caller.mark).not.toHaveBeenCalled()
    expect(harness.listeners.size).toBe(0)
    expect(harness.send.mock.calls.some(([method]) => method === 'Element.callMethod')).toBe(false)
  })

  it('does not retry business dispatch after its response was lost', async () => {
    const harness = createConnectionHarness()
    harness.loseInvocationResponse()
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])).rejects.toThrow('invoke response lost')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    expect(harness.listeners.size).toBe(0)
  })

  it('confirms local removal and releases its wrapper even when a host getter breaks after dispatch', async () => {
    const harness = createConnectionHarness()
    harness.caller.mark.mockImplementation(() => {
      harness.root.__glassEaselAdapter__.getVirtualDOM.mockImplementation(() => {
        throw new Error('host getter failed')
      })
      return 'completed'
    })
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])).resolves.toBe('completed')
    expect(harness.listeners.size).toBe(0)
    expect(harness.send.mock.calls.filter(([, payload]) => payload.method === 'releaseObject')).toHaveLength(1)
    expect(harness.caller.mark).toHaveBeenCalledOnce()
  })

  it.each(['rpc', 'string'] as const)('uses the original description when %s fallback conversion fails after one business call', async (failure) => {
    const harness = createConnectionHarness()
    const cyclic: any = {}
    cyclic.self = cyclic
    harness.caller.mark.mockReturnValue(cyclic)
    if (failure === 'rpc') {
      harness.failConversion()
    }
    else {
      harness.throwDuringConversion()
    }
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])).resolves.toBe('Object')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
  })

  it('preserves a cleanup owner and open transport until Connection.dispose can confirm removal', async () => {
    const harness = createConnectionHarness()
    const transport = Object.assign(new EventEmitter(), { send: vi.fn(), close: vi.fn(async () => {}) })
    const connection = new Connection(transport as any)
    connection.send = harness.send
    harness.fail('dispose')
    await expect(invokeComponentMethod(connection, harness.target, 'mark', ['value'])).rejects.toThrow('dispose failed')
    await expect(connection.dispose()).rejects.toThrow('cleanup remains incomplete')
    expect(transport.close).not.toHaveBeenCalled()
    harness.fail(undefined)
    await connection.dispose()
    expect(transport.close).toHaveBeenCalledOnce()
    expect(harness.listeners.size).toBe(0)
    expect(harness.send.mock.calls.filter(([, payload]) => payload.method === 'releaseObject')).toHaveLength(1)
    expect(harness.caller.mark).toHaveBeenCalledOnce()
  })

  it.each(['dispose', 'release'] as const)('blocks subsequent calls on a connection after %s cleanup failed', async (stage) => {
    const harness = createConnectionHarness()
    harness.fail(stage)
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['value'])).rejects.toThrow(`${stage} failed`)
    await expect(invokeComponentMethod(harness.connection, harness.target, 'mark', ['again'])).rejects.toThrow('reconnect before invoking')
    expect(harness.caller.mark).toHaveBeenCalledOnce()
    if (stage === 'dispose') {
      expect(harness.send.mock.calls.some(([, payload]) => payload.method === 'releaseObject')).toBe(false)
    }
    harness.fail(undefined)
    await cleanupComponentCallers(harness.connection)
    await cleanupComponentCallers(harness.connection)
    expect(harness.send.mock.calls.filter(([, payload]) => payload.method === 'releaseObject' && payload.params.objectId === 'owned-1')).toHaveLength(stage === 'release' ? 2 : 1)
    expect(harness.listeners.size).toBe(0)
  })

  it('serializes callers on one connection and leaves other connections independent', async () => {
    const first = createConnectionHarness()
    const second = createConnectionHarness()
    await expect(Promise.all([
      invokeComponentMethod(first.connection, first.target, 'mark', ['first']),
      invokeComponentMethod(first.connection, first.target, 'mark', ['next']),
      invokeComponentMethod(second.connection, second.target, 'mark', ['other']),
    ])).resolves.toEqual(['component:first', 'component:next', 'component:other'])
    expect(first.caller.mark).toHaveBeenCalledTimes(2)
    expect(second.caller.mark).toHaveBeenCalledOnce()
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(0)
  })
})
