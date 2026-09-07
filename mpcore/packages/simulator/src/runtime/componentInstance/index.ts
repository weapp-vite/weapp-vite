import type { CreateComponentInstanceOptions, HeadlessComponentInstance } from './types'
import { runComponentObservers } from './observers'
import {
  coerceComponentPropertyValue,
  normalizeComponentDefinition,
  normalizeComponentPropertyValue,
  resolveInitialData,
  resolveInitialProperties,
} from './properties'
import { assignByPath, bindFunction, cloneValue, hasComponentPropertyValueChanged, parseDataPath } from './shared'

export type { CreateComponentInstanceOptions, HeadlessComponentInstance } from './types'
export { cloneValue, coerceComponentPropertyValue, hasComponentPropertyValueChanged, normalizeComponentPropertyValue, runComponentObservers }

export function createComponentInstance(options: CreateComponentInstanceOptions): HeadlessComponentInstance {
  const definition = normalizeComponentDefinition(options.definition)
  const inputProperties = resolveInitialProperties(definition, options.properties ?? {})
  const data = {
    ...resolveInitialData(definition),
    ...Object.fromEntries(Object.keys(definition.properties ?? {}).map(key => [key, inputProperties[key]])),
  }
  const properties = { ...data, ...inputProperties }
  const instance: HeadlessComponentInstance = {
    __definition__: definition,
    data,
    __propertySnapshots__: {},
    properties,
    setData(patch, callback) {
      const changedKeys = Object.keys(patch)
      const dataKeys = [...new Set(changedKeys.map(key => parseDataPath(key)[0]!))]
      const propertyKeys = dataKeys
        .filter(key => Object.hasOwn(definition.properties ?? {}, key))
      const previousProperties = Object.fromEntries(propertyKeys.map(key => [key, cloneValue(instance.properties[key])]))
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }
      for (const key of dataKeys) {
        instance.properties[key] = instance.data[key]
      }

      runComponentObservers(definition, instance, changedKeys, previousProperties)
      if (options.requestRender) {
        options.requestRender(callback)
      }
      else {
        callback?.()
      }
    },
    triggerEvent(eventName, detail, triggerOptions) {
      options.triggerEvent?.(instance, eventName, detail, triggerOptions)
    },
  }

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'data' || key === 'methods' || key === 'properties' || key === 'observers' || key === 'lifetimes') {
      continue
    }
    bindFunction(instance, key, value)
  }

  for (const [key, value] of Object.entries(definition.methods ?? {})) {
    bindFunction(instance, key, value)
  }

  Object.defineProperty(instance, '__data__', {
    value: instance.data,
    enumerable: true,
    configurable: false,
    writable: false,
  })

  return instance
}

export function runComponentLifecycle(
  instance: HeadlessComponentInstance,
  lifecycleName: 'attached' | 'created' | 'detached' | 'ready',
) {
  const definition = instance.__definition__
  const fromLifetimes = definition?.lifetimes?.[lifecycleName]
  if (typeof fromLifetimes === 'function') {
    fromLifetimes.call(instance)
    return
  }
  const topLevel = definition?.[lifecycleName]
  if (typeof topLevel === 'function') {
    topLevel.call(instance)
  }
}

export function runComponentPageLifetime(
  instance: HeadlessComponentInstance,
  lifetimeName: 'hide' | 'resize' | 'show',
  payload?: unknown,
) {
  const pageLifetimes = instance.__definition__?.pageLifetimes
  const handler = pageLifetimes?.[lifetimeName]
  if (typeof handler !== 'function') {
    return
  }
  handler.call(instance, payload)
}
