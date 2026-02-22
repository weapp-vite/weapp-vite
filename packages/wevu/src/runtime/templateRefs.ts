import type { Ref } from '../reactivity'
import type { InternalRuntimeState } from './types'
import { isRef } from '../reactivity'
import { nextTick } from '../scheduler'
import { markNoSetData } from './noSetData'
import { getMiniProgramGlobalObject } from './platform'

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  get?: () => unknown
  kind?: 'component' | 'element'
}

type TemplateRefTarget
  = | { type: 'function', fn: (value: any) => void }
    | { type: 'ref', ref: Ref<any> }
    | { type: 'name', name: string }
    | { type: 'skip' }

type TemplateRefMap = Map<string, Ref<any>>
type NodesRefFields = Parameters<WechatMiniprogram.NodesRef['fields']>[0]
type TemplateRefUpdateCallback = () => void

function isComponentRef(binding: TemplateRefBinding) {
  return binding.kind === 'component'
}

function proxyRefs<T extends Record<string, any>>(target: T): T {
  return new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver) as unknown
      return isRef(value) ? value.value : value
    },
    set(obj, key, value, receiver) {
      const current = (obj as any)[key]
      if (isRef(current) && !isRef(value)) {
        current.value = value
        return true
      }
      return Reflect.set(obj, key, value, receiver)
    },
  })
}

function getExposeProxy(target: any, exposed: Record<string, any>) {
  const existing = target.__wevuExposeProxy
  if (existing && target.__wevuExposeRaw === exposed) {
    return existing
  }
  const proxy = proxyRefs(exposed)
  try {
    Object.defineProperty(target, '__wevuExposeProxy', {
      value: proxy,
      configurable: true,
      enumerable: false,
      writable: false,
    })
    Object.defineProperty(target, '__wevuExposeRaw', {
      value: exposed,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    target.__wevuExposeProxy = proxy
    target.__wevuExposeRaw = exposed
  }
  return proxy
}

function mergeComponentRefValue(
  wrapper: Record<string, any>,
  exposed: unknown,
) {
  if (!exposed || typeof exposed !== 'object') {
    return wrapper
  }
  const source = exposed as Record<string, any>
  const merged = new Proxy(wrapper, {
    get(target, key, receiver) {
      if (Reflect.has(target, key)) {
        return Reflect.get(target, key, receiver)
      }
      return source[key as keyof typeof source]
    },
    set(target, key, value, receiver) {
      if (key in source) {
        source[key as keyof typeof source] = value
        return true
      }
      return Reflect.set(target, key, value, receiver)
    },
    has(target, key) {
      return Reflect.has(target, key) || key in source
    },
    ownKeys(target) {
      return Array.from(new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(source)]))
    },
    getOwnPropertyDescriptor(target, key) {
      if (Reflect.has(target, key)) {
        return Object.getOwnPropertyDescriptor(target, key)
      }
      return Object.getOwnPropertyDescriptor(source, key)
    },
  })
  return markNoSetData(merged)
}

function resolveComponentPublicInstance(value: any) {
  if (!value || typeof value !== 'object') {
    return value ?? null
  }
  const instance = value as any
  const exposed = instance.__wevuExposed
  if (exposed && typeof exposed === 'object') {
    return getExposeProxy(instance, exposed as Record<string, any>)
  }
  if (instance.__wevu?.proxy) {
    return instance.__wevu.proxy
  }
  return value
}

function getTemplateRefMap(target: InternalRuntimeState): TemplateRefMap | undefined {
  return (target as any).__wevuTemplateRefMap as TemplateRefMap | undefined
}

function updateTemplateRefMapValue(
  refMap: TemplateRefMap | undefined,
  name: string,
  value: any,
) {
  if (!refMap) {
    return
  }
  const entry = refMap.get(name)
  if (entry) {
    entry.value = value
  }
}

function resolveTemplateRefTarget(
  target: InternalRuntimeState,
  binding: TemplateRefBinding,
): TemplateRefTarget {
  const proxy = target.__wevu?.proxy ?? target
  let resolved: unknown
  if (binding.get) {
    try {
      resolved = binding.get.call(proxy)
    }
    catch {
      resolved = undefined
    }
  }
  if (resolved == null && binding.name) {
    resolved = binding.name
  }
  if (typeof resolved === 'function') {
    return { type: 'function', fn: resolved as (value: any) => void }
  }
  if (isRef(resolved)) {
    return { type: 'ref', ref: resolved as Ref<any> }
  }
  if (typeof resolved === 'string' && resolved) {
    return { type: 'name', name: resolved }
  }
  if (binding.name) {
    return { type: 'name', name: binding.name }
  }
  return { type: 'skip' }
}

function ensureRefsContainer(target: InternalRuntimeState): Record<string, any> {
  const runtimeState = (target.__wevu?.state ?? target) as Record<string, any>
  const existing = runtimeState.$refs
  if (existing && typeof existing === 'object') {
    return existing as Record<string, any>
  }
  const refs = markNoSetData(Object.create(null))
  Object.defineProperty(runtimeState, '$refs', {
    value: refs,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  return refs
}

function createSelectorQuery(target: InternalRuntimeState): WechatMiniprogram.SelectorQuery | null {
  const instance = target as any
  if (instance && typeof instance.createSelectorQuery === 'function') {
    return instance.createSelectorQuery()
  }
  const miniProgramGlobal = getMiniProgramGlobalObject()
  if (miniProgramGlobal && typeof miniProgramGlobal.createSelectorQuery === 'function') {
    return miniProgramGlobal.createSelectorQuery().in(instance)
  }
  return null
}

function runQuery<T>(
  target: InternalRuntimeState,
  selector: string,
  options: { multiple: boolean, index?: number },
  apply: (nodesRef: WechatMiniprogram.NodesRef) => void,
  cb?: (value: T | null) => void,
): Promise<T | null> {
  const query = createSelectorQuery(target)
  if (!query) {
    const fallback = null
    if (cb) {
      cb(fallback)
    }
    return Promise.resolve(fallback)
  }
  const nodesRef = options.multiple ? query.selectAll(selector) : query.select(selector)
  apply(nodesRef)
  return new Promise((resolve) => {
    query.exec((res) => {
      let result: any = Array.isArray(res) ? res[0] : null
      if (options.index != null && Array.isArray(result)) {
        result = result[options.index] ?? null
      }
      if (cb) {
        cb(result ?? null)
      }
      resolve(result ?? null)
    })
  })
}

function createTemplateRefWrapper(
  target: InternalRuntimeState,
  selector: string,
  options: { multiple: boolean, index?: number },
) {
  const wrapper = {
    selector,
    boundingClientRect: (cb?: (value: any) => void) => {
      return runQuery(target, selector, options, ref => ref.boundingClientRect(), cb)
    },
    scrollOffset: (cb?: (value: any) => void) => {
      return runQuery(target, selector, options, ref => ref.scrollOffset(), cb)
    },
    fields: (fields: NodesRefFields, cb?: (value: any) => void) => {
      return runQuery(target, selector, options, ref => ref.fields(fields as any), cb)
    },
    node: (cb?: (value: any) => void) => {
      return runQuery(target, selector, options, ref => ref.node(), cb)
    },
  }
  return markNoSetData(wrapper)
}

function resolveComponentRefValue(
  target: InternalRuntimeState,
  binding: TemplateRefBinding,
) {
  const instance = target as any
  if (!instance) {
    return binding.inFor ? markNoSetData([]) : null
  }
  if (binding.inFor) {
    if (typeof instance.selectAllComponents === 'function') {
      const result = instance.selectAllComponents(binding.selector)
      const items = Array.isArray(result) ? result : []
      const merged = items.map((item, index) => {
        const wrapper = createTemplateRefWrapper(target, binding.selector, { multiple: true, index })
        return mergeComponentRefValue(wrapper as Record<string, any>, resolveComponentPublicInstance(item))
      })
      return markNoSetData(merged)
    }
    return markNoSetData([])
  }
  const wrapper = createTemplateRefWrapper(target, binding.selector, { multiple: false })
  if (typeof instance.selectComponent !== 'function') {
    return wrapper
  }
  const result = instance.selectComponent(binding.selector)
  return mergeComponentRefValue(wrapper as Record<string, any>, resolveComponentPublicInstance(result))
}

function buildTemplateRefValue(
  target: InternalRuntimeState,
  binding: TemplateRefBinding,
  result: unknown,
) {
  if (binding.inFor) {
    const items = Array.isArray(result) ? result : []
    const wrappers = items.map((_, index) => createTemplateRefWrapper(target, binding.selector, { multiple: true, index }))
    return markNoSetData(wrappers)
  }
  if (!result) {
    return null
  }
  return createTemplateRefWrapper(target, binding.selector, { multiple: false })
}

export function updateTemplateRefs(target: InternalRuntimeState, onResolved?: TemplateRefUpdateCallback) {
  const bindings = (target as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    onResolved?.()
    return
  }
  if (!(target as any).__wevuReadyCalled) {
    onResolved?.()
    return
  }
  if (!target.__wevu) {
    onResolved?.()
    return
  }
  const templateRefMap = getTemplateRefMap(target)
  const nodeBindings = bindings.filter(binding => !isComponentRef(binding))
  const componentEntries = bindings
    .filter(binding => isComponentRef(binding))
    .map(binding => ({
      binding,
      value: resolveComponentRefValue(target, binding),
    }))

  const applyEntries = (entries: Array<{ binding: TemplateRefBinding, value: any }>) => {
    const refsContainer = ensureRefsContainer(target)
    const nameEntries = new Map<string, { values: any[], count: number, hasFor: boolean }>()
    const nextNames = new Set<string>()
    const proxy = target.__wevu?.proxy ?? target
    entries.forEach((entry) => {
      const binding = entry.binding
      const value = entry.value
      const resolved = resolveTemplateRefTarget(target, binding)

      if (resolved.type === 'function') {
        if (binding.inFor && Array.isArray(value)) {
          if (value.length) {
            value.forEach(item => resolved.fn.call(proxy, item))
          }
          else {
            resolved.fn.call(proxy, null)
          }
        }
        else {
          resolved.fn.call(proxy, value ?? null)
        }
        return
      }

      if (resolved.type === 'ref') {
        resolved.ref.value = value
        return
      }

      if (resolved.type === 'name') {
        nextNames.add(resolved.name)
        const entry = nameEntries.get(resolved.name) ?? { values: [], count: 0, hasFor: false }
        entry.count += 1
        entry.hasFor = entry.hasFor || binding.inFor
        if (binding.inFor) {
          if (Array.isArray(value)) {
            entry.values.push(...value)
          }
        }
        else if (value != null) {
          entry.values.push(value)
        }
        nameEntries.set(resolved.name, entry)
      }
    })

    for (const [name, entry] of nameEntries) {
      let nextValue: any
      if (!entry.values.length) {
        nextValue = entry.hasFor ? markNoSetData([]) : null
      }
      else if (entry.hasFor || entry.values.length > 1 || entry.count > 1) {
        nextValue = markNoSetData(entry.values)
      }
      else {
        nextValue = entry.values[0]
      }
      refsContainer[name] = nextValue
      updateTemplateRefMapValue(templateRefMap, name, nextValue)
    }

    for (const key of Object.keys(refsContainer)) {
      if (!nextNames.has(key)) {
        delete refsContainer[key]
      }
    }

    onResolved?.()
  }

  if (!nodeBindings.length) {
    applyEntries(componentEntries)
    return
  }

  const query = createSelectorQuery(target)
  if (!query) {
    applyEntries(componentEntries)
    return
  }

  const nodeEntries: Array<{ binding: TemplateRefBinding }> = []
  for (const binding of nodeBindings) {
    const nodesRef = binding.inFor ? query.selectAll(binding.selector) : query.select(binding.selector)
    nodesRef.boundingClientRect()
    nodeEntries.push({ binding })
  }

  query.exec((res) => {
    const entries = nodeEntries.map((entry, index) => {
      const rawResult = Array.isArray(res) ? res[index] : null
      return {
        binding: entry.binding,
        value: buildTemplateRefValue(target, entry.binding, rawResult),
      }
    })
    applyEntries([...componentEntries, ...entries])
  })
}

export function scheduleTemplateRefUpdate(target: InternalRuntimeState, onResolved?: TemplateRefUpdateCallback) {
  const bindings = (target as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    onResolved?.()
    return
  }
  if (onResolved) {
    const callbacks = ((target as any).__wevuTemplateRefsCallbacks ?? []) as TemplateRefUpdateCallback[]
    callbacks.push(onResolved)
    if (!(target as any).__wevuTemplateRefsCallbacks) {
      Object.defineProperty(target, '__wevuTemplateRefsCallbacks', {
        value: callbacks,
        configurable: true,
        enumerable: false,
        writable: true,
      })
    }
  }
  if ((target as any).__wevuTemplateRefsPending) {
    return
  }
  ;(target as any).__wevuTemplateRefsPending = true
  nextTick(() => {
    ;(target as any).__wevuTemplateRefsPending = false
    const flushCallbacks = () => {
      const callbacks = (target as any).__wevuTemplateRefsCallbacks as TemplateRefUpdateCallback[] | undefined
      if (!callbacks || !callbacks.length) {
        return
      }
      callbacks.splice(0).forEach((cb) => {
        try {
          cb()
        }
        catch {
          // 忽略回调中的异常，避免影响后续更新
        }
      })
    }
    updateTemplateRefs(target, flushCallbacks)
  })
}

export function clearTemplateRefs(target: InternalRuntimeState) {
  const bindings = (target as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    return
  }
  const refsContainer = ensureRefsContainer(target)
  const proxy = target.__wevu?.proxy ?? target
  const nextNames = new Set<string>()
  const templateRefMap = getTemplateRefMap(target)

  for (const binding of bindings) {
    const resolved = resolveTemplateRefTarget(target, binding)
    const emptyValue = binding.inFor ? markNoSetData([]) : null
    if (resolved.type === 'function') {
      resolved.fn.call(proxy, null)
      continue
    }
    if (resolved.type === 'ref') {
      resolved.ref.value = emptyValue
      continue
    }
    if (resolved.type === 'name') {
      nextNames.add(resolved.name)
      refsContainer[resolved.name] = emptyValue
      updateTemplateRefMapValue(templateRefMap, resolved.name, emptyValue)
    }
  }

  for (const key of Object.keys(refsContainer)) {
    if (!nextNames.has(key)) {
      delete refsContainer[key]
    }
  }
}
