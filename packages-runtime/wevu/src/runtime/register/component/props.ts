import type { InternalRuntimeState } from '../../types'
import {
  WEVU_ATTRS_KEY,
  WEVU_PENDING_PROP_VALUES_KEY,
  WEVU_PROP_KEYS_KEY,
  WEVU_PROPS_DERIVED_KEYS_KEY,
  WEVU_PROPS_KEY,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { hasOwn } from '../../../utils'
import { refreshOwnerSnapshotFromInstance } from '../snapshot'

export function createPropsSync(options: {
  restOptions: Record<string, any>
  propsAliases?: Record<string, string>
  propsDerivedKeys?: string[]
  userObservers?: Record<string, any>
}) {
  const { restOptions, propsAliases, propsDerivedKeys, userObservers } = options
  const propKeys = restOptions.properties && typeof restOptions.properties === 'object'
    ? Object.keys(restOptions.properties as any)
    : []
  const propKeySet = new Set(propKeys)
  const propsDerivedKeySet = new Set(propsDerivedKeys ?? [])
  const aliasEntries = Object.entries(propsAliases ?? {})
    .filter(([alias, propName]) => alias && propName)
  const aliasKeySet = new Set(aliasEntries.map(([alias]) => alias))
  const directPropsDerivedKeys = [...propsDerivedKeySet]
    .filter(key => propKeySet.has(key) && !aliasKeySet.has(key))
  const templateRuntimePropKeys = new Set([
    WEVU_SLOT_NAMES_PROP,
    WEVU_SLOT_OWNER_ID_PROP,
    WEVU_SLOT_SCOPE_KEY,
  ])
  const syncedAliases = new WeakMap<InternalRuntimeState, Set<string>>()

  const isInternalAttrKey = (key: string) => key.startsWith('__wv_')

  const updateSnapshotOmitKeys = (instance: InternalRuntimeState) => {
    const runtime = (instance as any).__wevu
    const snapshotOmitKeys = runtime?.[WEVU_PROPS_DERIVED_KEYS_KEY]
    if (!(snapshotOmitKeys instanceof Set)) {
      return
    }
    for (const key of directPropsDerivedKeys) {
      snapshotOmitKeys.add(key)
    }
  }

  const setIfChanged = (target: Record<string, unknown>, key: string, value: unknown) => {
    if (hasOwn(target, key) && Object.is(target[key], value)) {
      return false
    }
    target[key] = value
    return true
  }

  const syncTemplateRuntimeProp = (instance: InternalRuntimeState, key: string, value: unknown) => {
    if (!templateRuntimePropKeys.has(key)) {
      return
    }
    let nativeDataChanged = false
    const runtimeState = (instance as any).__wevu?.state
    try {
      if (runtimeState && typeof runtimeState === 'object') {
        setIfChanged(runtimeState as Record<string, unknown>, key, value)
      }
      const nativeData = (instance as any).data
      if (nativeData && typeof nativeData === 'object') {
        nativeDataChanged = setIfChanged(nativeData as Record<string, unknown>, key, value)
      }
    }
    catch {
      // 忽略模板运行时字段同步失败，保持 props 主链路可用。
    }
    if (!nativeDataChanged || typeof (instance as any).setData !== 'function') {
      return
    }
    try {
      ;(instance as any).setData({ [key]: value })
    }
    catch {
      // 忽略模板桥接字段 setData 失败，后续响应式调度仍可兜底。
    }
  }

  const syncSetupStatePropsAliases = (instance: InternalRuntimeState, propsProxy: Record<string, unknown>) => {
    if (!aliasEntries.length) {
      return
    }
    const runtime = (instance as any).__wevu
    const setupState = runtime?.setupState
    const state = runtime?.state
    if (!setupState || typeof setupState !== 'object') {
      return
    }
    updateSnapshotOmitKeys(instance)
    const aliases = syncedAliases.get(instance) ?? new Set<string>()
    syncedAliases.set(instance, aliases)
    for (const [alias, propName] of aliasEntries) {
      if (hasOwn(setupState, alias) && !aliases.has(alias)) {
        continue
      }
      const value = propsProxy[propName]
      try {
        setIfChanged(setupState as Record<string, unknown>, alias, value)
        aliases.add(alias)
      }
      catch {
        // 忽略 alias 同步失败，保持 props 主链路可用。
      }
      if (state && typeof state === 'object' && (!hasOwn(state, alias) || aliases.has(alias))) {
        try {
          setIfChanged(state as Record<string, unknown>, alias, value)
        }
        catch {
          // 旧兼容 state 写入失败时不阻断运行时。
        }
      }
    }
  }

  const syncPropsDerivedKeys = (instance: InternalRuntimeState, propsProxy: Record<string, unknown>) => {
    if (!propsDerivedKeySet.size) {
      return
    }
    const runtime = (instance as any).__wevu
    const setupState = runtime?.setupState
    if (!setupState || typeof setupState !== 'object') {
      return
    }
    updateSnapshotOmitKeys(instance)
    const aliasToPropName = new Map<string, string>(aliasEntries)
    for (const key of propsDerivedKeySet) {
      const propName = aliasToPropName.get(key) ?? key
      if (!hasOwn(propsProxy, propName)) {
        continue
      }
      try {
        setIfChanged(setupState as Record<string, unknown>, key, propsProxy[propName])
      }
      catch {
        // 忽略 props-derived 同步失败，保持主 props 链路可用。
      }
    }
  }

  const attachWevuPropKeys = (instance: InternalRuntimeState) => {
    try {
      Object.defineProperty(instance, WEVU_PROP_KEYS_KEY, {
        value: propKeys,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(instance as any)[WEVU_PROP_KEYS_KEY] = propKeys
    }
  }

  const syncWevuAttrsFromInstance = (instance: InternalRuntimeState) => {
    const attrsProxy = (instance as any)[WEVU_ATTRS_KEY]
    if (!attrsProxy || typeof attrsProxy !== 'object') {
      return
    }
    const hasRuntimeStateKey = (key: string) => {
      const runtimeState = (instance as any).__wevu?.state
      return runtimeState != null
        && typeof runtimeState === 'object'
        && hasOwn(runtimeState as Record<string, unknown>, key)
    }

    const properties = (instance as any).properties
    const next = properties && typeof properties === 'object'
      ? (properties as Record<string, unknown>)
      : undefined

    const currentKeys = Object.keys(attrsProxy as any)
    for (const existingKey of currentKeys) {
      if (
        !next
        || !hasOwn(next, existingKey)
        || isInternalAttrKey(existingKey)
        || propKeySet.has(existingKey)
        || hasRuntimeStateKey(existingKey)
      ) {
        try {
          delete (attrsProxy as any)[existingKey]
        }
        catch {
          // 忽略异常
        }
      }
    }

    if (!next) {
      refreshOwnerSnapshotFromInstance(instance)
      return
    }

    for (const [key, value] of Object.entries(next)) {
      if (isInternalAttrKey(key) || propKeySet.has(key) || hasRuntimeStateKey(key)) {
        continue
      }
      try {
        ;(attrsProxy as any)[key] = value
      }
      catch {
        // 忽略异常
      }
    }

    refreshOwnerSnapshotFromInstance(instance)
  }

  const syncWevuPropsFromInstance = (instance: InternalRuntimeState) => {
    const propsProxy = (instance as any)[WEVU_PROPS_KEY]
    const properties = (instance as any).properties
    const pendingPropValues = (instance as any)[WEVU_PENDING_PROP_VALUES_KEY] as Record<string, unknown> | undefined

    if (propsProxy && typeof propsProxy === 'object' && properties && typeof properties === 'object') {
      const next = properties as any
      const currentKeys = Object.keys(propsProxy as any)
      for (const existingKey of currentKeys) {
        if (!hasOwn(next, existingKey)) {
          try {
            delete (propsProxy as any)[existingKey]
          }
          catch {
            // 忽略异常
          }
        }
      }
      for (const [k, v] of Object.entries(next)) {
        const nextValue = pendingPropValues && hasOwn(pendingPropValues, k)
          ? pendingPropValues[k]
          : v
        try {
          ;(propsProxy as any)[k] = nextValue
        }
        catch {
          // 忽略异常
        }
        syncTemplateRuntimeProp(instance, k, nextValue)
      }
      if (pendingPropValues) {
        for (const [k, v] of Object.entries(pendingPropValues)) {
          if (!hasOwn(next, k)) {
            try {
              ;(propsProxy as any)[k] = v
            }
            catch {
              // 忽略异常
            }
            syncTemplateRuntimeProp(instance, k, v)
          }
        }
      }
      syncPropsDerivedKeys(instance, propsProxy as Record<string, unknown>)
      syncSetupStatePropsAliases(instance, propsProxy as Record<string, unknown>)
      refreshOwnerSnapshotFromInstance(instance)
    }
    if (pendingPropValues) {
      delete (instance as any)[WEVU_PENDING_PROP_VALUES_KEY]
    }

    syncWevuAttrsFromInstance(instance)
  }

  const syncWevuPropsFromValues = (instance: InternalRuntimeState, values: Record<string, unknown> | undefined) => {
    if (!values || typeof values !== 'object') {
      return
    }
    const propsProxy = (instance as any)[WEVU_PROPS_KEY]
    if (!propsProxy || typeof propsProxy !== 'object') {
      return
    }
    let changed = false
    for (const key of propKeys) {
      if (!hasOwn(values, key)) {
        continue
      }
      try {
        ;(propsProxy as any)[key] = values[key]
        changed = true
      }
      catch {
        // 忽略 query props 同步失败，保持页面生命周期主链路可用。
      }
      syncTemplateRuntimeProp(instance, key, values[key])
    }
    if (!changed) {
      return
    }
    syncPropsDerivedKeys(instance, propsProxy as Record<string, unknown>)
    syncSetupStatePropsAliases(instance, propsProxy as Record<string, unknown>)
    refreshOwnerSnapshotFromInstance(instance)
    syncWevuAttrsFromInstance(instance)
  }

  const syncWevuPropValue = (instance: InternalRuntimeState, key: string, value: unknown) => {
    const propsProxy = (instance as any)[WEVU_PROPS_KEY]
    if (!propsProxy || typeof propsProxy !== 'object') {
      return
    }
    try {
      ;(propsProxy as any)[key] = value
    }
    catch {
      // 忽略异常
    }
    syncTemplateRuntimeProp(instance, key, value)
    const pendingPropValues = ((instance as any)[WEVU_PENDING_PROP_VALUES_KEY] ??= Object.create(null)) as Record<string, unknown>
    pendingPropValues[key] = value
    syncPropsDerivedKeys(instance, propsProxy as Record<string, unknown>)
    syncSetupStatePropsAliases(instance, propsProxy as Record<string, unknown>)
    refreshOwnerSnapshotFromInstance(instance)
    syncWevuAttrsFromInstance(instance)
  }

  const injectedObservers: Record<string, any> = {}
  if (propKeys.length) {
    for (const key of propKeys) {
      injectedObservers[key] = function __wevu_prop_observer(this: InternalRuntimeState, newValue: unknown) {
        // 注意：在部分小程序运行时中，observer 回调触发时 `this.properties` 可能尚未更新，
        // 因此这里以 observer 的 newValue 为准写入 propsProxy，避免出现 props 仍为旧值/undefined。
        syncWevuPropValue(this, key, newValue)
      }
    }
  }

  const finalObservers: Record<string, any> = {
    ...(userObservers ?? {}),
  }
  for (const [key, injected] of Object.entries(injectedObservers)) {
    const existing = finalObservers[key]
    if (typeof existing === 'function') {
      finalObservers[key] = function chainedObserver(this: InternalRuntimeState, ...args: any[]) {
        existing.apply(this, args)
        injected.apply(this, args)
      }
    }
    else {
      finalObservers[key] = injected
    }
  }

  const allObserver = finalObservers['**']
  finalObservers['**'] = function __wevu_observer_all(this: InternalRuntimeState, ...args: any[]) {
    if (typeof allObserver === 'function') {
      allObserver.apply(this, args)
    }
    syncWevuPropsFromInstance(this)
  }

  return {
    attachWevuPropKeys,
    directPropsDerivedKeys,
    syncWevuPropsFromInstance,
    syncWevuPropsFromValues,
    finalObservers,
  }
}
