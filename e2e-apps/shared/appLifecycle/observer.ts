export const APP_HOOKS = ['onLaunch', 'onShow', 'onHide', 'onError', 'onPageNotFound', 'onUnhandledRejection', 'onThemeChange'] as const
export type AppHook = typeof APP_HOOKS[number]
type Callback = (this: unknown, ...args: any[]) => any

export interface HostLifecycleEntry {
  id: number
  hook: AppHook
  channel: 'App' | 'wx'
  args: string
  summary: string
  diagnostics: Record<string, unknown>
}
export interface HookLifecycleEntry {
  hostId: number | null
  hook: AppHook
  args: string
  sameArguments: boolean
  summary: string
}
export interface HostLifecycleEvidence {
  host: HostLifecycleEntry[]
  hooks: HookLifecycleEntry[]
}

/** 保留 undefined、非枚举属性和循环引用；只读取属性描述符，不执行宿主参数中的 getter。 */
function createArgumentSnapshot() {
  const identities = new Map<unknown, number>()
  const identity = (value: unknown) => {
    if (!identities.has(value)) {
      identities.set(value, identities.size + 1)
    }
    return identities.get(value)!
  }
  return (args: unknown[]) => {
    const seen = new Map<object, number>()
    const encode = (value: unknown): unknown => {
      const type = typeof value
      if (value === null) {
        return null
      }
      if (type === 'undefined') {
        return { type }
      }
      if (type === 'number') {
        return { type, value: Object.is(value, -0) ? '-0' : String(value) }
      }
      if (type === 'bigint') {
        return { type, value: String(value) }
      }
      if (type === 'function' || type === 'symbol') {
        return { type, identity: identity(value) }
      }
      if (type !== 'object') {
        return value
      }
      const target = value as object
      if (seen.has(target)) {
        return { ref: seen.get(target) }
      }
      const id = seen.size + 1
      seen.set(target, id)
      const keys: PropertyKey[] = [...Object.getOwnPropertyNames(target).sort(), ...Object.getOwnPropertySymbols(target)]
      return {
        id,
        array: Array.isArray(target),
        properties: keys.map((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(target, key)!
          return [typeof key === 'symbol' ? encode(key) : key, 'value' in descriptor
            ? encode(descriptor.value)
            : { getter: encode(descriptor.get), setter: encode(descriptor.set) }]
        }),
      }
    }
    return JSON.stringify(encode(args))
  }
}

function inputSummary(hook: AppHook, args: unknown[]) {
  if (hook !== 'onLaunch' && hook !== 'onShow') {
    return `${hook}: ${args.length} arguments`
  }
  const seen = new Set<object>()
  const plain = (value: unknown): unknown => {
    if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol') {
      return `[${typeof value}]`
    }
    if (value === null || typeof value !== 'object') {
      return value
    }
    if (seen.has(value)) {
      return '[reference]'
    }
    seen.add(value)
    const out: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {}
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      Object.defineProperty(out, key, { value: 'value' in descriptor ? plain(descriptor.value) : '[accessor]', enumerable: true })
    }
    return out
  }
  const input = plain(args[0]) as { path?: unknown, scene?: unknown, query?: unknown } | undefined
  return `${hook}: path=${JSON.stringify(input?.path)} scene=${JSON.stringify(input?.scene)} query=${JSON.stringify(input?.query)}`
}

/** 仅装饰 fixture 的真实宿主注册边界；所有回调同步沿用原 this、参数对象、返回值与异常。 */
export function installHostLifecycleObserver(host: { App: Callback, wx: Record<string, any> }) {
  const snapshot = createArgumentSnapshot()
  const evidence: HostLifecycleEvidence = { host: [], hooks: [] }
  const active: Array<{ entry: HostLifecycleEntry, args: unknown[] }> = []
  const observed = new WeakSet<Callback>()
  const originalApp = host.App
  if (typeof originalApp !== 'function') {
    // eslint-disable-next-line unicorn/prefer-type-error -- 格式修正保持既有观察器失败类型不变。
    throw new Error('Native App registration is unavailable')
  }

  const diagnosticApis = () => {
    const result: Record<string, unknown> = {}
    for (const name of ['getLaunchOptionsSync', 'getEnterOptionsSync']) {
      const api = host.wx[name]
      if (typeof api !== 'function') {
        result[name] = { available: false }
      }
      else {
        try {
          result[name] = { available: true, args: snapshot([api.call(host.wx)]) }
        }
        catch (error) {
          result[name] = { available: true, error: String(error) }
        }
      }
    }
    return result
  }
  const wrap = (hook: AppHook, callback: Callback, channel: 'App' | 'wx'): Callback => {
    if (observed.has(callback)) {
      return callback
    }
    const wrapped: Callback = function (...args) {
      const entry: HostLifecycleEntry = {
        id: evidence.host.length + 1,
        hook,
        channel,
        args: snapshot(args),
        summary: inputSummary(hook, args),
        diagnostics: hook === 'onLaunch' || hook === 'onShow' ? diagnosticApis() : {},
      }
      evidence.host.push(entry)
      active.push({ entry, args })
      try {
        return callback.apply(this, args)
      }
      finally {
        active.pop()
      }
    }
    observed.add(wrapped)
    return wrapped
  }

  for (const hook of APP_HOOKS.slice(3)) {
    const on = host.wx[hook]
    const offName = hook.replace(/^on/, 'off')
    const off = host.wx[offName]
    if (typeof on !== 'function') {
      continue
    }
    const callbacks = new WeakMap<Callback, Callback>()
    host.wx[hook] = function (...args: unknown[]) {
      const callback = args[0]
      if (typeof callback !== 'function') {
        return on.apply(this, args)
      }
      const wrapped = callbacks.get(callback as Callback) ?? wrap(hook, callback as Callback, 'wx')
      callbacks.set(callback as Callback, wrapped)
      args[0] = wrapped
      return on.apply(this, args)
    }
    if (typeof off === 'function') {
      host.wx[offName] = function (...args: unknown[]) {
        if (typeof args[0] === 'function') {
          args[0] = callbacks.get(args[0] as Callback) ?? args[0]
        }
        return off.apply(this, args)
      }
    }
  }

  host.App = function (options: Record<string, unknown>, ...rest: unknown[]) {
    host.App = originalApp
    for (const hook of APP_HOOKS) {
      if (typeof options[hook] === 'function') {
        options[hook] = wrap(hook, options[hook] as Callback, 'App')
      }
    }
    return originalApp.call(this, options, ...rest)
  }

  return {
    record(hook: AppHook, args: unknown[]) {
      const boundary = active[active.length - 1]
      evidence.hooks.push({
        hostId: boundary?.entry.id ?? null,
        hook,
        args: snapshot(args),
        summary: inputSummary(hook, args),
        sameArguments: boundary?.entry.hook === hook && args.length === boundary.args.length
          && args.every((arg, index) => Object.is(arg, boundary.args[index])),
      })
    },
    read(): HostLifecycleEvidence {
      return { host: evidence.host.map(entry => ({ ...entry, diagnostics: JSON.parse(JSON.stringify(entry.diagnostics)) as Record<string, unknown> })), hooks: evidence.hooks.map(entry => ({ ...entry })) }
    },
  }
}
