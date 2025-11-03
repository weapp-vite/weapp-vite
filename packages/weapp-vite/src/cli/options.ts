import type { GlobalCLIOptions } from './types'

export function filterDuplicateOptions<T extends object>(options: T) {
  for (const [key, value] of Object.entries(options)) {
    if (Array.isArray(value)) {
      options[key as keyof T] = value[value.length - 1]
    }
  }
}

export function resolveConfigFile(options: Pick<GlobalCLIOptions, 'config' | 'c'>) {
  if (typeof options.config === 'string') {
    return options.config
  }
  if (typeof options.c === 'string') {
    return options.c
  }
}

export function convertBase(value: any) {
  if (value === 0) {
    return ''
  }
  return value
}

export function coerceBooleanOption(value: unknown) {
  if (value === undefined) {
    return undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === '') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') {
      return false
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') {
      return true
    }
    return true
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return Boolean(value)
}
