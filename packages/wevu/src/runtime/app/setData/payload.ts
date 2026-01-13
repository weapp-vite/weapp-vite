export function collapsePayload(input: Record<string, any>) {
  const keys = Object.keys(input).sort()
  if (keys.length <= 1) {
    return input
  }
  const out: Record<string, any> = Object.create(null)
  const prefixStack: string[] = []
  for (const key of keys) {
    while (prefixStack.length) {
      const prefix = prefixStack[prefixStack.length - 1]
      if (key.startsWith(prefix)) {
        break
      }
      prefixStack.pop()
    }
    if (prefixStack.length) {
      continue
    }
    out[key] = input[key]
    prefixStack.push(`${key}.`)
  }
  return out
}

export function estimateJsonSize(
  value: any,
  limit: number,
  seen: WeakSet<object>,
): number {
  if (limit <= 0) {
    return limit + 1
  }
  if (value === null) {
    return 4
  }
  const t = typeof value
  if (t === 'string') {
    // 粗略估算：未计入转义开销；后续会在接近阈值时用 stringify 校验
    return 2 + value.length
  }
  if (t === 'number') {
    return Number.isFinite(value) ? String(value).length : 4 // 空值占位
  }
  if (t === 'boolean') {
    return value ? 4 : 5
  }
  if (t === 'undefined' || t === 'function' || t === 'symbol') {
    return 4 // 空值占位
  }
  if (t !== 'object') {
    return 4
  }

  if (seen.has(value)) {
    return 4
  }
  seen.add(value)

  if (Array.isArray(value)) {
    let size = 2 // []
    for (let i = 0; i < value.length; i++) {
      if (i) {
        size += 1
      }
      size += estimateJsonSize(value[i], limit - size, seen)
      if (size > limit) {
        return size
      }
    }
    return size
  }

  let size = 2 // {}
  for (const [k, v] of Object.entries(value)) {
    if (size > 2) {
      size += 1
    }
    // 键名部分：
    size += 2 + k.length + 1
    size += estimateJsonSize(v, limit - size, seen)
    if (size > limit) {
      return size
    }
  }
  return size
}

export function checkPayloadSize(payload: Record<string, any>, maxPayloadBytes: number) {
  if (maxPayloadBytes === Number.POSITIVE_INFINITY) {
    return { fallback: false as const, estimatedBytes: undefined as number | undefined, bytes: undefined as number | undefined }
  }
  const limit = maxPayloadBytes
  const keyCount = Object.keys(payload).length
  const estimated = estimateJsonSize(payload, limit + 1, new WeakSet())
  if (estimated > limit) {
    return { fallback: true as const, estimatedBytes: estimated, bytes: undefined }
  }
  // 接近阈值时再用 stringify 精确判断，避免低估导致未降级
  if (estimated >= limit * 0.85 && keyCount > 2) {
    try {
      const bytes = JSON.stringify(payload).length
      return { fallback: bytes > limit, estimatedBytes: estimated, bytes }
    }
    catch {
      return { fallback: false as const, estimatedBytes: estimated, bytes: undefined }
    }
  }
  return { fallback: false as const, estimatedBytes: estimated, bytes: undefined }
}

export function mergeSiblingPayload(options: {
  input: Record<string, any>
  entryMap: Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>
  getPlainByPath: (path: string) => any
  mergeSiblingThreshold: number
  mergeSiblingSkipArray: boolean
  mergeSiblingMaxParentBytes: number
  mergeSiblingMaxInflationRatio: number
}) {
  const {
    input,
    entryMap,
    getPlainByPath,
    mergeSiblingThreshold,
    mergeSiblingSkipArray,
    mergeSiblingMaxParentBytes,
    mergeSiblingMaxInflationRatio,
  } = options

  if (!mergeSiblingThreshold) {
    return { out: input, merged: 0 }
  }

  const keys = Object.keys(input)
  if (keys.length < mergeSiblingThreshold) {
    return { out: input, merged: 0 }
  }

  const groups = new Map<string, string[]>()
  const hasDelete = new Set<string>()

  for (const key of keys) {
    const entry = entryMap.get(key)
    if (!entry) {
      continue
    }
    if (input[key] === null || entry.op === 'delete') {
      const dot = key.lastIndexOf('.')
      if (dot > 0) {
        hasDelete.add(key.slice(0, dot))
      }
      continue
    }
    const dot = key.lastIndexOf('.')
    if (dot <= 0) {
      continue
    }
    const parent = key.slice(0, dot)
    const list = groups.get(parent) ?? []
    list.push(key)
    groups.set(parent, list)
  }

  const parents = Array.from(groups.entries())
    .filter(([parent, list]) => list.length >= mergeSiblingThreshold && !hasDelete.has(parent))
    .sort((a, b) => b[0].split('.').length - a[0].split('.').length)

  if (!parents.length) {
    return { out: input, merged: 0 }
  }

  const out: Record<string, any> = Object.create(null)
  Object.assign(out, input)

  let merged = 0
  const valueSizeCache = new WeakMap<object, number>()
  const estimateValueSize = (value: any) => {
    if (value && typeof value === 'object') {
      const cached = valueSizeCache.get(value as object)
      if (cached !== undefined) {
        return cached
      }
      const size = estimateJsonSize(value, Number.POSITIVE_INFINITY, new WeakSet())
      valueSizeCache.set(value as object, size)
      return size
    }
    return estimateJsonSize(value, Number.POSITIVE_INFINITY, new WeakSet())
  }
  const estimateEntryBytes = (key: string, value: any) => {
    // 键名部分：
    return (2 + key.length + 1) + estimateValueSize(value)
  }

  for (const [parent, list] of parents) {
    if (Object.prototype.hasOwnProperty.call(out, parent)) {
      continue
    }
    const existingChildren = list.filter(k => Object.prototype.hasOwnProperty.call(out, k))
    if (existingChildren.length < mergeSiblingThreshold) {
      continue
    }
    const parentValue = getPlainByPath(parent)
    if (mergeSiblingSkipArray && Array.isArray(parentValue)) {
      continue
    }
    if (mergeSiblingMaxParentBytes !== Number.POSITIVE_INFINITY) {
      const parentBytes = estimateEntryBytes(parent, parentValue)
      if (parentBytes > mergeSiblingMaxParentBytes) {
        continue
      }
    }
    if (mergeSiblingMaxInflationRatio !== Number.POSITIVE_INFINITY) {
      let childBytes = 0
      for (const child of existingChildren) {
        childBytes += estimateEntryBytes(child, out[child])
      }
      const parentBytes = estimateEntryBytes(parent, parentValue)
      if (parentBytes > childBytes * mergeSiblingMaxInflationRatio) {
        continue
      }
    }
    out[parent] = parentValue
    for (const child of existingChildren) {
      delete out[child]
    }
    merged += 1
  }

  return { out, merged }
}
