import { unref } from '../reactivity'

const hyphenateRE = /\B([A-Z])/g

function hyphenate(value: string) {
  if (!value) {
    return ''
  }
  if (value.startsWith('--')) {
    return value
  }
  return value.replace(hyphenateRE, '-$1').toLowerCase()
}

function appendStyle(base: string, part: string) {
  if (!part) {
    return base
  }
  if (!base) {
    return part
  }
  let next = base
  if (!next.endsWith(';')) {
    next += ';'
  }
  const normalized = part.startsWith(';') ? part.slice(1) : part
  return next + normalized
}

function stringifyStyle(value: Record<string, any>) {
  let res = ''
  for (const key of Object.keys(value)) {
    const raw = unref(value[key])
    if (raw == null) {
      continue
    }
    const name = hyphenate(key)
    if (Array.isArray(raw)) {
      for (const itemValue of raw) {
        const item = unref(itemValue)
        if (item == null) {
          continue
        }
        res = appendStyle(res, `${name}:${item}`)
      }
    }
    else {
      res = appendStyle(res, `${name}:${raw}`)
    }
  }
  return res
}

export function normalizeStyle(value: any): string {
  const unwrapped = unref(value)
  if (unwrapped == null) {
    return ''
  }
  if (typeof unwrapped === 'string') {
    return unwrapped
  }
  if (Array.isArray(unwrapped)) {
    let res = ''
    for (const item of unwrapped) {
      const normalized = normalizeStyle(item)
      if (normalized) {
        res = appendStyle(res, normalized)
      }
    }
    return res
  }
  if (typeof unwrapped === 'object') {
    return stringifyStyle(unwrapped)
  }
  return ''
}

export function normalizeClass(value: any): string {
  const unwrapped = unref(value)
  let res = ''
  if (!unwrapped) {
    return res
  }
  if (typeof unwrapped === 'string') {
    return unwrapped
  }
  if (Array.isArray(unwrapped)) {
    for (const item of unwrapped) {
      const normalized = normalizeClass(item)
      if (normalized) {
        res += `${normalized} `
      }
    }
    return res.trim()
  }
  if (typeof unwrapped === 'object') {
    for (const key of Object.keys(unwrapped)) {
      if (unref(unwrapped[key])) {
        res += `${key} `
      }
    }
    return res.trim()
  }
  return res
}
