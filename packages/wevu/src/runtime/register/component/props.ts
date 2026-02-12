import type { InternalRuntimeState } from '../../types'
import { refreshOwnerSnapshotFromInstance } from '../snapshot'

export function createPropsSync(options: {
  restOptions: Record<string, any>
  userObservers?: Record<string, any>
}) {
  const { restOptions, userObservers } = options
  const propKeys = restOptions.properties && typeof restOptions.properties === 'object'
    ? Object.keys(restOptions.properties as any)
    : []
  const propKeySet = new Set(propKeys)

  const attachWevuPropKeys = (instance: InternalRuntimeState) => {
    try {
      Object.defineProperty(instance, '__wevuPropKeys', {
        value: propKeys,
        configurable: true,
        enumerable: false,
        writable: false,
      })
    }
    catch {
      ;(instance as any).__wevuPropKeys = propKeys
    }
  }

  const syncWevuAttrsFromInstance = (instance: InternalRuntimeState) => {
    const attrsProxy = (instance as any).__wevuAttrs
    if (!attrsProxy || typeof attrsProxy !== 'object') {
      return
    }
    const hasRuntimeStateKey = (key: string) => {
      const runtimeState = (instance as any).__wevu?.state
      return runtimeState != null
        && typeof runtimeState === 'object'
        && Object.prototype.hasOwnProperty.call(runtimeState as Record<string, unknown>, key)
    }

    const properties = (instance as any).properties
    const next = properties && typeof properties === 'object'
      ? (properties as Record<string, unknown>)
      : undefined

    const currentKeys = Object.keys(attrsProxy as any)
    for (const existingKey of currentKeys) {
      if (
        !next
        || !Object.prototype.hasOwnProperty.call(next, existingKey)
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
      if (propKeySet.has(key) || hasRuntimeStateKey(key)) {
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
    const propsProxy = (instance as any).__wevuProps
    const properties = (instance as any).properties

    if (propsProxy && typeof propsProxy === 'object' && properties && typeof properties === 'object') {
      const next = properties as any
      const currentKeys = Object.keys(propsProxy as any)
      for (const existingKey of currentKeys) {
        if (!Object.prototype.hasOwnProperty.call(next, existingKey)) {
          try {
            delete (propsProxy as any)[existingKey]
          }
          catch {
            // 忽略异常
          }
        }
      }
      for (const [k, v] of Object.entries(next)) {
        try {
          ;(propsProxy as any)[k] = v
        }
        catch {
          // 忽略异常
        }
      }
      refreshOwnerSnapshotFromInstance(instance)
    }

    syncWevuAttrsFromInstance(instance)
  }

  const syncWevuPropValue = (instance: InternalRuntimeState, key: string, value: unknown) => {
    const propsProxy = (instance as any).__wevuProps
    if (!propsProxy || typeof propsProxy !== 'object') {
      return
    }
    try {
      ;(propsProxy as any)[key] = value
    }
    catch {
      // 忽略异常
    }
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
    syncWevuPropsFromInstance,
    finalObservers,
  }
}
