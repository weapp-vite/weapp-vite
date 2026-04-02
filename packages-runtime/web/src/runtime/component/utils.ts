import type { PropertyOption } from './types'

export function hyphenate(name: string) {
  return name.replace(/([A-Z])/g, (_, char: string) => `-${char.toLowerCase()}`)
}

export function toCamelCase(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

export function cloneValue(value: any) {
  if (Array.isArray(value)) {
    return value.slice()
  }
  if (value && typeof value === 'object') {
    return { ...value }
  }
  return value
}

export function coerceValue(value: any, type?: PropertyOption['type']) {
  if (type === Boolean) {
    if (value === '' || value === true) {
      return true
    }
    if (value === undefined || value === null || value === false) {
      return false
    }
    if (typeof value === 'string') {
      return value !== 'false'
    }
    return Boolean(value)
  }

  if (type === Number) {
    if (value === undefined || value === null) {
      return value
    }
    const numeric = Number(value)
    return Number.isNaN(numeric) ? value : numeric
  }

  if (type === Object || type === Array) {
    if (value === undefined || value === null) {
      return value
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      }
      catch {
        return value
      }
    }
    return value
  }

  return value
}
