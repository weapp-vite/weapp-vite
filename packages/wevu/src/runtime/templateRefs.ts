import type { InternalRuntimeState } from './types'
import { nextTick } from '../scheduler'
import { markNoSetData } from './noSetData'
import {
  buildTemplateRefValue,
  createSelectorQuery,
  ensureRefsContainer,
  getTemplateRefMap,
  isComponentRef,
  resolveComponentRefValue,
  resolveTemplateRefTarget,
  updateTemplateRefMapValue,
} from './templateRefs/helpers'

export interface TemplateRefBinding {
  selector: string
  inFor: boolean
  name?: string
  get?: () => unknown
  kind?: 'component' | 'element'
}

type TemplateRefUpdateCallback = () => void

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
