import type { WritableComputedOptions } from '../../reactivity'
import type { ComputedDefinitions, SetDataSnapshotOptions } from '../types'
import { WEVU_SLOT_OWNER_ID_KEY } from '@weapp-core/constants'
import { hasOwn } from '../../utils'
import { resolveSetDataOptions } from '../app/setDataOptions'
import { toPlain } from '../diff'

class InitialComputedBailout extends Error {}

function resolveComputedGetter(definition: unknown) {
  if (typeof definition === 'function') {
    return definition
  }
  const getter = (definition as WritableComputedOptions<any> | undefined)?.get
  return typeof getter === 'function' ? getter : undefined
}

function isCompilerGeneratedTemplateComputedKey(key: string) {
  return key.startsWith('__wv_bind_')
    || key.startsWith('__wv_cls_')
    || key.startsWith('__wv_style_')
}

function canResolveInitialTemplateComputed(key: string, getter: (...args: any[]) => unknown) {
  if (!key.startsWith('__wv_bind_')) {
    return false
  }
  try {
    return !/\bthis\b/.test(Function.prototype.toString.call(getter))
  }
  catch {
    return false
  }
}

function resolveRuntimeBindingPlaceholder(key: string) {
  if (key === WEVU_SLOT_OWNER_ID_KEY) {
    return ''
  }
  if (key.startsWith('__wv_bind_')) {
    return null
  }
  if (key.startsWith('__wv_cls_') || key.startsWith('__wv_style_')) {
    return ''
  }
}

function resolveRuntimeBindingPlaceholderData(
  data: Record<string, any>,
  setData: SetDataSnapshotOptions | undefined,
) {
  const pickKeys = Array.isArray(setData?.pick) ? setData.pick : []
  if (!pickKeys.length) {
    return undefined
  }
  const omitKeys = new Set(Array.isArray(setData?.omit) ? setData.omit : [])
  const resolved: Record<string, any> = {}
  for (const key of pickKeys) {
    if (omitKeys.has(key) || hasOwn(data, key)) {
      continue
    }
    const placeholder = resolveRuntimeBindingPlaceholder(key)
    if (placeholder !== undefined) {
      resolved[key] = placeholder
    }
  }
  return Object.keys(resolved).length ? resolved : undefined
}

export function resolveInitialComputedData(options: {
  data: Record<string, any>
  computed: ComputedDefinitions | undefined
  setData: SetDataSnapshotOptions | undefined
}) {
  const {
    data,
    computed,
    setData,
  } = options
  const computedKeys = computed ? Object.keys(computed) : []
  if (!computedKeys.length) {
    return undefined
  }

  const {
    includeComputed,
    shouldIncludeKey,
    toPlainMaxDepth,
    toPlainMaxKeys,
    includeFunctions,
    functionPaths,
  } = resolveSetDataOptions(setData)
  if (!includeComputed) {
    return undefined
  }

  const resolved: Record<string, any> = {}
  const resolving = new Set<string>()
  let proxy!: Record<string, any>
  const resolveComputedValue = (key: string): { ok: true, value: any } | { ok: false } => {
    if (hasOwn(data, key) || !shouldIncludeKey(key)) {
      return { ok: false }
    }
    if (hasOwn(resolved, key)) {
      return { ok: true, value: resolved[key] }
    }
    if (resolving.has(key)) {
      return { ok: false }
    }
    const getter = resolveComputedGetter((computed as ComputedDefinitions)[key])
    if (!getter) {
      return { ok: false }
    }
    resolving.add(key)
    try {
      const rawValue = getter.call(proxy)
      if (rawValue === undefined) {
        return { ok: false }
      }
      const value = toPlain(rawValue, new WeakMap(), {
        maxDepth: toPlainMaxDepth,
        maxKeys: toPlainMaxKeys,
        includeFunctions,
        functionPaths,
        _path: key,
      })
      if (value === undefined) {
        return { ok: false }
      }
      resolved[key] = value
      return { ok: true, value }
    }
    catch {
      return { ok: false }
    }
    finally {
      resolving.delete(key)
    }
  }

  proxy = new Proxy(data, {
    get(target, key, receiver) {
      if (typeof key === 'string') {
        if (key === 'data' || key === '$state') {
          return data
        }
        if (key === 'props' || key === '$props' || key === '$attrs') {
          throw new InitialComputedBailout()
        }
        if (hasOwn(data, key)) {
          return Reflect.get(target, key, receiver)
        }
        if (computed && hasOwn(computed, key)) {
          const computedValue = resolveComputedValue(key)
          if (computedValue.ok) {
            return computedValue.value
          }
          throw new InitialComputedBailout()
        }
        throw new InitialComputedBailout()
      }
      return Reflect.get(target, key, receiver)
    },
    has(target, key) {
      return Reflect.has(target, key)
        || (typeof key === 'string' && Boolean(
          computed && hasOwn(computed, key),
        ))
    },
  })

  for (const key of computedKeys) {
    const getter = resolveComputedGetter((computed as ComputedDefinitions)[key])
    if (isCompilerGeneratedTemplateComputedKey(key) && (!getter || !canResolveInitialTemplateComputed(key, getter))) {
      continue
    }
    resolveComputedValue(key)
  }

  return Object.keys(resolved).length ? resolved : undefined
}

export function resolveNativeInitialData(
  data: unknown,
  computed: ComputedDefinitions | undefined,
  setData: SetDataSnapshotOptions | undefined,
) {
  if (!data || typeof data !== 'object') {
    return data
  }
  const initialComputedData = resolveInitialComputedData({
    data: data as Record<string, any>,
    computed,
    setData,
  })
  const runtimeBindingPlaceholderData = resolveRuntimeBindingPlaceholderData(data as Record<string, any>, setData)
  return initialComputedData || runtimeBindingPlaceholderData
    ? {
        ...(data as Record<string, any>),
        ...runtimeBindingPlaceholderData,
        ...initialComputedData,
      }
    : data
}
