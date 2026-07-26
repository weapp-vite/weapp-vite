import type {
  ComponentOptions,
  ComponentPublicInstance,
  DataRecord,
} from './types'

function normalizeObserverPattern(pattern: string) {
  return pattern.split(',').map(item => item.trim()).filter(Boolean)
}

function hasOwn(value: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function resolveObservedValue(instance: ComponentPublicInstance, pattern: string) {
  if (pattern === '**') {
    return {
      ...instance.properties,
      ...instance.data,
    }
  }

  const segments = pattern
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  const [root, ...rest] = segments
  if (!root) {
    return undefined
  }
  let current = hasOwn(instance.properties, root)
    ? instance.properties[root]
    : instance.data[root]
  for (const segment of rest) {
    current = current?.[segment]
  }
  return current
}

function matchesObserverPattern(pattern: string, changedKeys: string[]) {
  if (pattern === '**') {
    return changedKeys.length > 0
  }
  return normalizeObserverPattern(pattern).some((observedKey) => {
    if (observedKey === '**') {
      return true
    }
    return changedKeys.some(changedKey => (
      changedKey === observedKey
      || changedKey.startsWith(`${observedKey}.`)
      || changedKey.startsWith(`${observedKey}[`)
    ))
  })
}

export function runComponentObservers(
  component: ComponentOptions,
  instance: ComponentPublicInstance,
  changedKeys: string[],
  previousProperties: DataRecord = {},
) {
  if (!changedKeys.length) {
    return
  }

  for (const changedKey of changedKeys) {
    const option = component.properties?.[changedKey]
    option?.observer?.call(
      instance,
      instance.properties[changedKey],
      previousProperties[changedKey],
    )
  }

  for (const [pattern, observer] of Object.entries(component.observers ?? {})) {
    if (typeof observer !== 'function' || !matchesObserverPattern(pattern, changedKeys)) {
      continue
    }
    observer.call(
      instance,
      ...normalizeObserverPattern(pattern).map(item => resolveObservedValue(instance, item)),
    )
  }
}
