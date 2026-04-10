import type { CreateComponentInstanceOptions, HeadlessComponentInstance } from './types'
import { runComponentObservers } from './observers'
import {
  coerceComponentPropertyValue,
  normalizeComponentDefinition,
  normalizeComponentPropertyValue,
  resolveInitialData,
  resolveInitialProperties,
} from './properties'
import { assignByPath, bindFunction, cloneValue } from './shared'

export type { CreateComponentInstanceOptions, HeadlessComponentInstance } from './types'
export { cloneValue, coerceComponentPropertyValue, normalizeComponentPropertyValue, runComponentObservers }

export function createComponentInstance(options: CreateComponentInstanceOptions): HeadlessComponentInstance {
  const definition = normalizeComponentDefinition(options.definition)
  const instance: HeadlessComponentInstance = {
    __definition__: definition,
    data: resolveInitialData(definition),
    __propertySnapshots__: {},
    properties: resolveInitialProperties(definition, options.properties ?? {}),
    setData(patch, callback) {
      const changedKeys = Object.keys(patch)
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }

      runComponentObservers(definition, instance, changedKeys)

      callback?.()
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
