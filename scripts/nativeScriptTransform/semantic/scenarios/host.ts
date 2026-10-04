import type { InlineExpressionMap } from '../../../../packages-runtime/wevu/src/runtime/register/inline'
import type { SemanticTools } from '../types'
import type {} from './hostGlobals'
import assert from 'node:assert/strict'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import { computed } from '../../../../packages-runtime/wevu/src/reactivity/computed'
import { effectScope } from '../../../../packages-runtime/wevu/src/reactivity/core'
import { isRef, ref, unref } from '../../../../packages-runtime/wevu/src/reactivity/ref'
import { runInlineExpression } from '../../../../packages-runtime/wevu/src/runtime/register/inline'
import { normalizeClass, normalizeStyle, resolvePropValue } from '../../../../packages-runtime/wevu/src/runtime/template'

export type Values = Record<string, any>
export interface Options extends Values {
  setup: (props: Values, context: { expose: (...args: unknown[]) => void }) => Values
  data: () => Values
  computed: Record<string, (this: Values) => unknown>
  methods: Record<string, InlineExpressionMap>
}

/** 有限宿主对象遇到未声明的方法或属性立即拒绝。 */
export function strictObject<T extends object>(label: string, value: T): T {
  return new Proxy(Object.freeze(value), {
    get(target, key, receiver) {
      if (typeof key === 'symbol' || Object.hasOwn(target, key)) {
        return Reflect.get(target, key, receiver)
      }
      throw new Error(`Unsupported ${label}.${key}`)
    },
  })
}

export function createScenarioHost(tools: SemanticTools, lifecycleNames: string[]) {
  const scope = effectScope()
  const trace: { label: string, value: unknown }[] = []
  const assertions: { id: string, passed: true, actual: unknown }[] = []
  const hooks = new Map<string, (...args: any[]) => unknown>()
  const registrations: Options[] = []
  const exposures: unknown[][] = []
  const inlineInvocations: { id: string, executions: number }[] = []
  const computedInvocations: { id: string, executions: number }[] = []
  const lifecycleInvocations: { id: string, executions: number }[] = []
  const logs: { channel: string, arguments: unknown[] }[] = []
  const nativeInstance = Object.freeze({ semanticHost: 'finite-native-instance' })
  const record = (label: string, value: unknown = null) => {
    const data = tools.snapshot(value)
    trace.push({ label, value: data })
    tools.record(label, data)
  }
  const check = (id: string, actual: unknown, expected: unknown) => {
    const observed = tools.snapshot(actual)
    assert.deepEqual(observed, tools.snapshot(expected), id)
    assertions.push({ id, passed: true, actual: observed })
  }
  const runtime: Values = {
    installInlineEvents() { record('install-inline-events') },
    createWevuComponent(options: Options) {
      assert.equal(typeof options?.setup, 'function')
      registrations.push(options)
      record('register-component', { isPage: options.__wevu_isPage })
    },
  }
  if (lifecycleNames.length) {
    runtime.useNativeInstance = () => {
      record('native-instance')
      return nativeInstance
    }
  }
  for (const name of lifecycleNames) {
    runtime[name] = (fn: (...args: any[]) => unknown) => {
      assert.equal(typeof fn, 'function')
      assert(!hooks.has(name), `Duplicate lifecycle ${name}`)
      hooks.set(name, new Proxy(fn, {
        apply(target, thisArg, args) {
          lifecycleInvocations.push({ id: name, executions: 1 })
          record('lifecycle-executed', name)
          return Reflect.apply(target, thisArg, args)
        },
      }))
      record('register-hook', name)
    }
  }
  const consoleStub = Object.fromEntries(['log', 'warn', 'error'].map(channel => [channel, (...args: unknown[]) => {
    logs.push({ channel, arguments: args })
    record(`console-${channel}`, args)
  }]))
  function initialize(namespace: Record<string, unknown>, expectedInline: string[], expectedComputed: string[]) {
    check('registration-count', registrations.length, 1)
    assert.strictEqual(namespace.default, registrations[0], 'Default export must be the actual registered object')
    check('registration-order', trace.map(entry => entry.label), ['install-inline-events', 'register-component'])
    const options = registrations[0]!
    check('page-flag', options.__wevu_isPage, true)
    check('manifest-frozen', Object.isFrozen(options.__wevuBindingManifest), true)
    const first = options.data()
    const second = options.data()
    assert.notStrictEqual(first, second)
    for (const [key, value] of Object.entries(first)) {
      if (value && typeof value === 'object') {
        assert.notStrictEqual(value, second[key], `Shared data field ${key}`)
      }
    }
    check('data-factory-independent', first, second)
    const state = scope.run(() => options.setup({}, { expose: (...args) => {
      exposures.push(args)
      record('setup-expose', args)
    } }))!
    check('setup-expose', exposures, [[]])
    check('lifecycle-registration', [...hooks.keys()], lifecycleNames)
    check('inline-inventory', Object.keys(options.methods[WEVU_INLINE_MAP_KEY]!).sort(), [...expectedInline].sort())
    check('computed-inventory', Object.keys(options.computed).sort(), [...expectedComputed].sort())
    const ctx: Values = { $state: state, __wevuProps: {} }
    for (const key of Object.keys(state)) {
      Object.defineProperty(ctx, key, {
        configurable: true,
        enumerable: true,
        get: () => unref(state[key]),
        set: (value) => {
          if (isRef(state[key])) {
            state[key].value = value
          }
          else { state[key] = value }
        },
      })
    }
    const instrumentedComputed = Object.fromEntries(Object.entries(options.computed).map(([id, fn]) => [id, new Proxy(fn, {
      apply(target, thisArg, args) {
        computedInvocations.push({ id, executions: 1 })
        record('computed-executed', id)
        return Reflect.apply(target, thisArg, args)
      },
    })]))
    const observedOptions: Options = { ...options, computed: instrumentedComputed }
    return { options: observedOptions, state, ctx, initialData: first }
  }
  function dispatch(options: Options, ctx: Values, id: string, detail?: unknown, dataset: Values = {}) {
    const original = options.methods[WEVU_INLINE_MAP_KEY]!
    assert(Object.hasOwn(original, id), `Unknown inline handler ${id}`)
    const entry = original[id]!
    assert.equal(typeof entry.fn, 'function')
    const invocation = { id, executions: 0 }
    inlineInvocations.push(invocation)
    const instrumented = { ...original, [id]: { ...entry, fn: new Proxy(entry.fn, {
      apply(target, thisArg, args) {
        invocation.executions++
        return Reflect.apply(target, thisArg, args)
      },
    }) } }
    const returned = runInlineExpression(ctx, undefined, {
      detail,
      url: '/wrong-top-level-url',
      buyNum: 99,
      currentTarget: { dataset: { wvInlineId: id, wvEventDetail: true, ...dataset } },
      target: { dataset: { wvInlineId: 'not-a-handler', wvS0: 'wrong-target' } },
    }, instrumented)
    assert.equal(invocation.executions, 1, `Handler ${id} did not actually execute exactly once`)
    record('inline-executed', invocation)
    return returned
  }
  return {
    imports: {
      'virtual:weapp-vite/runtime': runtime,
      'virtual:weapp-vite/runtime/reactivity': { computed, ref, unref },
      'virtual:weapp-vite/runtime/template': { normalizeClass, normalizeStyle, resolvePropValue },
    },
    globals: { console: strictObject('console', consoleStub) },
    nativeInstance,
    hooks,
    trace,
    assertions,
    inlineInvocations,
    logs,
    check,
    record,
    initialize,
    dispatch,
    dispose() { scope.stop() },
    pick(ctx: Values, keys: string[]) { return Object.fromEntries(keys.map(key => [key, ctx[key]])) },
    finish(expectedInline: string[], requiredAssertions: string[]) {
      check('all-inline-executed', [...new Set(inlineInvocations.filter(item => item.executions === 1).map(item => item.id))].sort(), [...expectedInline].sort())
      assert(requiredAssertions.every(id => assertions.some(item => item.id === id)), 'Missing required independent assertion')
      return { assertions, inlineInvocations, computedInvocations, lifecycleInvocations, trace, logs, hostScope: 'Finite registration/lifecycle capture; not the Wevu Component host runtime' }
    },
  }
}

export type ScenarioHost = ReturnType<typeof createScenarioHost>

/** 只允许显式登记的服务和导航调用；结算由场景控制，不靠计时器碰运气。 */
export function createDeferredCalls(host: ScenarioHost, tools: SemanticTools, allowed: string[]) {
  const pending = new Map<string, { resolve: (value: unknown) => void, reject: (error: Error) => void }>()
  const calls: { name: string, args: unknown[] }[] = []
  return {
    calls,
    invoke(name: string, args: unknown[]) {
      assert(allowed.includes(name), `Unknown deferred method ${name}`)
      assert(!pending.has(name), `Unsettled duplicate ${name}`)
      const request = { name, args: structuredClone(args) }
      calls.push(request)
      host.record('async-start', request)
      const promise = new Promise<unknown>((resolve, reject) => pending.set(name, { resolve, reject }))
      return tools.track(name, promise)
    },
    async resolve(name: string, value: unknown) {
      assert(pending.has(name), `No pending ${name}`)
      const item = pending.get(name)!
      pending.delete(name)
      host.record('async-resolve', name)
      item.resolve(value)
      for (let turn = 0; turn < 8; turn++) {
        await Promise.resolve()
      }
    },
    async reject(name: string, message: string) {
      assert(pending.has(name), `No pending ${name}`)
      const item = pending.get(name)!
      pending.delete(name)
      host.record('async-reject', name)
      item.reject(new Error(message))
      for (let turn = 0; turn < 8; turn++) {
        await Promise.resolve()
      }
    },
    names() { return [...pending.keys()] },
    assertEmpty() { assert.equal(pending.size, 0, 'Unsettled services/navigation') },
  }
}
