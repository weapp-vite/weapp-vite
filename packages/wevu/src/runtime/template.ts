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
    const raw = value[key]
    if (raw == null) {
      continue
    }
    const name = hyphenate(key)
    if (Array.isArray(raw)) {
      for (const item of raw) {
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
  if (value == null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    let res = ''
    for (const item of value) {
      const normalized = normalizeStyle(item)
      if (normalized) {
        res = appendStyle(res, normalized)
      }
    }
    return res
  }
  if (typeof value === 'object') {
    return stringifyStyle(value)
  }
  return ''
}

export function normalizeClass(value: any): string {
  let res = ''
  if (!value) {
    return res
  }
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeClass(item)
      if (normalized) {
        res += `${normalized} `
      }
    }
    return res.trim()
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (value[key]) {
        res += `${key} `
      }
    }
    return res.trim()
  }
  return res
}
