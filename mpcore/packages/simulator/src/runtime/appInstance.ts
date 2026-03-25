import type { HeadlessAppDefinition } from '../host'

export interface HeadlessAppInstance extends Record<string, any> {
  globalData: Record<string, any>
}

function bindFunction(target: Record<string, any>, key: string, value: unknown) {
  if (typeof value !== 'function') {
    target[key] = value
    return
  }
  target[key] = (...args: any[]) => value.apply(target, args)
}

function resolveInitialData(definition: HeadlessAppDefinition) {
  const rawData = definition.data
  if (typeof rawData === 'function') {
    const next = rawData.call(definition)
    return next && typeof next === 'object' && !Array.isArray(next)
      ? { ...next }
      : {}
  }
  return rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? { ...rawData }
    : {}
}

export function createAppInstance(definition: HeadlessAppDefinition): HeadlessAppInstance {
  const instance: HeadlessAppInstance = {
    globalData: resolveInitialData(definition),
  }

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'data') {
      continue
    }
    bindFunction(instance, key, value)
  }

  return instance
}
