import type { Ref } from '../../reactivity'
import type { TemplateRefBinding } from '../templateRefs'
import type { InternalRuntimeState } from '../types'
import { isRef } from '../../reactivity'
import { markNoSetData } from '../noSetData'
import { getMiniProgramGlobalObject } from '../platform'

type TemplateRefTarget
  = | { type: 'function', fn: (value: any) => void }
    | { type: 'ref', ref: Ref<any> }
    | { type: 'name', name: string }
    | { type: 'skip' }

export type TemplateRefMap = Map<string, Ref<any>>
type NodesRefFields = Parameters<WechatMiniprogram.NodesRef['fields']>[0]

export function isComponentRef(binding: TemplateRefBinding) {
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
      return [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(source)])]
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

export function getTemplateRefMap(target: InternalRuntimeState): TemplateRefMap | undefined {
  return (target as any).__wevuTemplateRefMap as TemplateRefMap | undefined
}

export function updateTemplateRefMapValue(
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

export function resolveTemplateRefTarget(
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

export function ensureRefsContainer(target: InternalRuntimeState): Record<string, any> {
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

export function createSelectorQuery(target: InternalRuntimeState): WechatMiniprogram.SelectorQuery | null {
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

export function resolveComponentRefValue(
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

export function buildTemplateRefValue(
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
