import type { HeadlessPageDefinition } from '../host'

export interface HeadlessPageInstance extends Record<string, any> {
  data: Record<string, any>
  route: string
  setData: (patch: Record<string, any>) => void
}

function bindFunction(target: Record<string, any>, key: string, value: unknown) {
  if (typeof value !== 'function') {
    target[key] = value
    return
  }
  target[key] = (...args: any[]) => value.apply(target, args)
}

function cloneObject(value: Record<string, any>) {
  return JSON.parse(JSON.stringify(value))
}

function resolveInitialData(definition: HeadlessPageDefinition) {
  const rawData = definition.data
  if (typeof rawData === 'function') {
    const next = rawData.call(definition)
    return next && typeof next === 'object' && !Array.isArray(next)
      ? cloneObject(next)
      : {}
  }
  return rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? cloneObject(rawData)
    : {}
}

function assignByPath(target: Record<string, any>, path: string, value: unknown) {
  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) {
    return
  }
  let current: Record<string, any> = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!
    const next = current[segment]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[segment] = {}
    }
    current = current[segment]
  }
  current[segments[segments.length - 1]!] = value
}

export function createPageInstance(route: string, definition: HeadlessPageDefinition): HeadlessPageInstance {
  const instance: HeadlessPageInstance = {
    data: resolveInitialData(definition),
    route,
    setData(patch) {
      for (const [key, value] of Object.entries(patch)) {
        assignByPath(instance.data, key, value)
      }
    },
  }

  for (const [key, value] of Object.entries(definition)) {
    if (key === 'data') {
      continue
    }
    bindFunction(instance, key, value)
  }

  return instance
}
