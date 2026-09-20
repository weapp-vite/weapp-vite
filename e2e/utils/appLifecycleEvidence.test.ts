import type { AppHook } from '../../e2e-apps/shared/appLifecycle/observer'
import { describe, expect, it, vi } from 'vitest'
import { APP_HOOKS, installHostLifecycleObserver } from '../../e2e-apps/shared/appLifecycle/observer'
import { assertHostLifecycleForwarding } from './appLifecycleEvidence'

function createHost() {
  let options: Record<string, (...args: any[]) => any> = {}
  const callbacks = new Map<string, (...args: any[]) => any>()
  const wx: Record<string, any> = {
    getLaunchOptionsSync: vi.fn(() => ({ path: 'pages/index/index', scene: 1001, query: {} })),
    getEnterOptionsSync: vi.fn(() => ({ path: 'pages/index/index', scene: 1001, query: {} })),
  }
  for (const hook of APP_HOOKS.slice(3)) {
    wx[hook] = vi.fn((callback: (...args: any[]) => any) => callbacks.set(hook, callback))
    wx[hook.replace(/^on/, 'off')] = vi.fn((callback?: (...args: any[]) => any) => {
      if (!callback || callbacks.get(hook) === callback) {
        callbacks.delete(hook)
      }
    })
  }
  const nativeApp = vi.fn((value: typeof options) => {
    options = value
    return 'registered'
  })
  const host = { App: nativeApp as (...args: any[]) => any, wx }
  const originalApis = { ...wx }
  const observer = installHostLifecycleObserver(host)
  return { host, nativeApp, observer, callbacks, originalApis, options: () => options }
}

describe('cold app lifecycle host boundary', () => {
  it.each(APP_HOOKS)('captures native %s with the same this, arguments and return value', (hook) => {
    const harness = createHost()
    const receiver = { app: true }
    const input = { path: '', scene: -1, query: { from: 'cold' } }
    const second = { extra: true }
    const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
      expect(this).toBe(receiver)
      harness.observer.record(hook, args)
      return second
    })
    expect(harness.host.App({ [hook]: callback })).toBe('registered')
    expect(harness.host.App).toBe(harness.nativeApp)
    expect(harness.options()[hook]!.call(receiver, input, second)).toBe(second)
    expect(callback).toHaveBeenCalledWith(input, second)
    const evidence = harness.observer.read()
    expect(evidence.host).toHaveLength(1)
    expect(evidence.hooks[0]).toMatchObject({ hostId: 1, hook, args: evidence.host[0]!.args, sameArguments: true })
  })

  it('preserves the first cold host input even when synchronous launch APIs report a different value', () => {
    const harness = createHost()
    harness.host.App({ onLaunch: (...args: unknown[]) => harness.observer.record('onLaunch', args) })
    harness.options().onLaunch!({ path: '', scene: -1, query: {} })
    const evidence = harness.observer.read()
    assertHostLifecycleForwarding(evidence, [{ hook: 'onLaunch' }])
    expect(evidence.host[0]!.summary).toContain('scene=-1')
    expect(evidence.host[0]!.diagnostics.getLaunchOptionsSync).toMatchObject({ available: true })
    expect(JSON.stringify(evidence.host[0]!.diagnostics)).toContain('1001')
  })

  it.each([
    ['path', (input: Record<string, any>) => {
      input.path = 'pages/changed/index'
    }],
    ['scene', (input: Record<string, any>) => {
      input.scene = 1001
    }],
    ['query', (input: Record<string, any>) => {
      input.query.nested.from = 'changed'
    }],
    ['undefined property', (input: Record<string, any>) => {
      delete input.optional
    }],
  ] as const)('fails when forwarding mutates %s', (_name, mutate) => {
    const harness = createHost()
    harness.host.App({
      onLaunch(input: Record<string, any>) {
        mutate(input)
        harness.observer.record('onLaunch', [input])
      },
    })
    harness.options().onLaunch!({ path: '', scene: -1, query: { nested: { from: 'cold' } }, optional: undefined })
    expect(() => assertHostLifecycleForwarding(harness.observer.read(), [{ hook: 'onLaunch' }])).toThrow('complete arguments')
  })

  it('fails when forwarding replaces an argument with an equal clone', () => {
    const harness = createHost()
    harness.host.App({ onLaunch: (input: object) => harness.observer.record('onLaunch', [{ ...input }]) })
    harness.options().onLaunch!({ path: '', scene: -1 })
    expect(() => assertHostLifecycleForwarding(harness.observer.read(), [{ hook: 'onLaunch' }])).toThrow('original argument identities')
  })

  it.each(['onError', 'onPageNotFound', 'onUnhandledRejection', 'onThemeChange'] as AppHook[])('captures Wevu wx.%s callbacks and preserves on/off callback identity', (hook) => {
    const harness = createHost()
    const rawOn = vi.mocked(harness.originalApis[hook])
    const offName = hook.replace(/^on/, 'off')
    const receiver = { channel: 'wx' }
    const callback = vi.fn(function (this: unknown, ...args: unknown[]) {
      expect(this).toBe(receiver)
      harness.observer.record(hook, args)
      return 'forwarded'
    })
    harness.host.App({ onLaunch: (...args: unknown[]) => harness.observer.record('onLaunch', args) })
    harness.options().onLaunch!({ path: 'pages/index/index', scene: 1001 })
    harness.host.wx[hook].call(receiver, callback)
    const registered = harness.callbacks.get(hook)!
    const input = Object.assign(new Error('host error'), { reason: { message: 'original' } })
    expect(registered.call(receiver, input)).toBe('forwarded')
    assertHostLifecycleForwarding(harness.observer.read(), [{ hook: 'onLaunch' }, { hook }])
    harness.host.wx[offName].call(receiver, callback)
    expect(harness.callbacks.has(hook)).toBe(false)
    expect(callback).toHaveBeenCalledWith(input)
    expect(rawOn.mock.calls).toEqual([[registered]])
    expect(rawOn.mock.contexts[0]).toBe(receiver)
    const rawOff = vi.mocked(harness.originalApis[offName])
    expect(rawOff.mock.calls).toEqual([[registered]])
    expect(rawOff.mock.contexts[0]).toBe(receiver)
  })

  it('preserves zero-argument off calls and forwards callback exceptions unchanged', () => {
    const on = vi.fn()
    const off = vi.fn()
    const wx = { onError: on, offError: off }
    const observer = installHostLifecycleObserver({ App: vi.fn(), wx })
    const failure = new Error('original callback failure')
    const receiver = { channel: 'wx' }
    const callback = function (this: unknown, ...args: unknown[]) {
      expect(this).toBe(receiver)
      observer.record('onError', args)
      throw failure
    }
    wx.onError.call(receiver, callback)
    const wrapped = on.mock.calls[0]![0] as (...args: unknown[]) => void
    expect(() => wrapped.call(receiver, failure)).toThrow(failure)
    wx.offError.call(receiver)
    expect(off.mock.calls).toEqual([[]])
    expect(off.mock.contexts[0]).toBe(receiver)
    expect(observer.read().hooks[0]!.sameArguments).toBe(true)
  })

  it('does not execute parameter getters or query toJSON while capturing or rendering summaries', () => {
    const harness = createHost()
    const getter = vi.fn(() => {
      throw new Error('must not read getter')
    })
    const toJSON = vi.fn(() => {
      throw new Error('must not call toJSON')
    })
    const input = Object.defineProperty({ scene: 1001, query: { toJSON } }, 'path', { get: getter, enumerable: true })
    harness.host.App({ onLaunch: (...args: unknown[]) => harness.observer.record('onLaunch', args) })
    harness.options().onLaunch!(input)
    assertHostLifecycleForwarding(harness.observer.read(), [{ hook: 'onLaunch' }])
    expect(getter).not.toHaveBeenCalled()
    expect(toJSON).not.toHaveBeenCalled()
  })

  it('does not expose mutable diagnostic objects through read snapshots', () => {
    const harness = createHost()
    harness.host.App({ onLaunch: (...args: unknown[]) => harness.observer.record('onLaunch', args) })
    harness.options().onLaunch!({ path: '', scene: -1 })
    const snapshot = harness.observer.read()
    ;(snapshot.host[0]!.diagnostics.getLaunchOptionsSync as { available: boolean }).available = false
    expect(harness.observer.read().host[0]!.diagnostics.getLaunchOptionsSync).toMatchObject({ available: true })
  })
})
