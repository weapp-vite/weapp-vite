import type { Ref } from '../reactivity'
import type { InternalRuntimeState } from './types'
import { isRef } from '../reactivity'
import { nextTick } from '../scheduler'
import { markNoSetData } from './noSetData'

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  get?: () => unknown
}

type TemplateRefTarget
  = | { type: 'function', fn: (value: any) => void }
    | { type: 'ref', ref: Ref<any> }
    | { type: 'name', name: string }
    | { type: 'skip' }

type TemplateRefMap = Map<string, Ref<any>>
type NodesRefFields = Parameters<WechatMiniprogram.NodesRef['fields']>[0]

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
  if (typeof wx !== 'undefined' && typeof wx.createSelectorQuery === 'function') {
    return wx.createSelectorQuery().in(instance)
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

export function updateTemplateRefs(target: InternalRuntimeState) {
  const bindings = (target as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    return
  }
  if (!(target as any).__wevuReadyCalled) {
    return
  }
  if (!target.__wevu) {
    return
  }
  const query = createSelectorQuery(target)
  if (!query) {
    return
  }

  const entries: Array<{ binding: TemplateRefBinding }> = []
  const templateRefMap = getTemplateRefMap(target)
  for (const binding of bindings) {
    const nodesRef = binding.inFor ? query.selectAll(binding.selector) : query.select(binding.selector)
    nodesRef.boundingClientRect()
    entries.push({ binding })
  }

  query.exec((res) => {
    const refsContainer = ensureRefsContainer(target)
    const nameEntries = new Map<string, { values: any[], count: number, hasFor: boolean }>()
    const nextNames = new Set<string>()
    const proxy = target.__wevu?.proxy ?? target

    entries.forEach((entry, index) => {
      const binding = entry.binding
      const rawResult = Array.isArray(res) ? res[index] : null
      const value = buildTemplateRefValue(target, binding, rawResult)
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
  })
}

export function scheduleTemplateRefUpdate(target: InternalRuntimeState) {
  const bindings = (target as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  if (!bindings || !bindings.length) {
    return
  }
  if ((target as any).__wevuTemplateRefsPending) {
    return
  }
  ;(target as any).__wevuTemplateRefsPending = true
  nextTick(() => {
    ;(target as any).__wevuTemplateRefsPending = false
    updateTemplateRefs(target)
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
