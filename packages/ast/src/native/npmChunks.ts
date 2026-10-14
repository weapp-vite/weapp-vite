export interface NativeNpmChunkAnalysisInput {
  code: string
  filename?: string
}

export interface NativeNpmRequireFact {
  start: number
  end: number
  importee: string
}

export interface NativeNpmPlatformApiFact {
  start: number
  end: number
}

export interface NativeNpmLocalRootFact {
  kind: 'alias' | 'require' | 'interop'
  requireIndex?: number
  bindingName?: string
  referenceName?: string
  importee?: string
  secondArgumentStart?: number
  secondArgumentEnd?: number
}

export interface NativeNpmChunkAnalysis {
  requires: NativeNpmRequireFact[]
  platformApiRanges: NativeNpmPlatformApiFact[]
  localRootFacts: NativeNpmLocalRootFact[]
}

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function readDenseArray<T>(value: unknown, read: (value: unknown) => T | undefined) {
  if (!Array.isArray(value)) {
    return undefined
  }
  const length = value.length
  if (!Number.isSafeInteger(length) || length < 0) {
    return undefined
  }
  const values: T[] = []
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) {
      return undefined
    }
    const item = read(value[index])
    if (item === undefined) {
      return undefined
    }
    values.push(item)
  }
  return values
}

function readRange(value: Record<string, unknown>, code: string, startKey = 'start', endKey = 'end') {
  const start = value[startKey]
  const end = value[endKey]
  if (typeof start !== 'number' || typeof end !== 'number'
    || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end <= start || end > code.length) {
    return undefined
  }
  return { start, end }
}

/** 校验并复制普通快照，避免后续消费者持有 native binding 的 getter 或稀疏数组。 */
export function readNativeNpmChunkAnalysis(value: unknown, code: string): NativeNpmChunkAnalysis | undefined {
  try {
    const raw = record(value)
    if (!raw) {
      return undefined
    }
    const requires = readDenseArray(raw.requires, (item) => {
      const fact = record(item)
      const range = fact && readRange(fact, code)
      const importee = fact?.importee
      if (!fact || !range || typeof importee !== 'string') {
        return undefined
      }
      const literal = code.slice(range.start, range.end)
      if (!/^['"`]/.test(literal) || literal.at(-1) !== literal[0]) {
        return undefined
      }
      if (literal.includes('\\')) {
        if (literal[0] !== '"' || JSON.parse(literal) !== importee) {
          return undefined
        }
      }
      else if (literal.slice(1, -1) !== importee) {
        return undefined
      }
      return { ...range, importee }
    })
    const platformApiRanges = readDenseArray(raw.platformApiRanges, (item) => {
      const fact = record(item)
      const range = fact && readRange(fact, code)
      if (!range || !/^(?:wx|my|tt|swan|jd|xhs)$/.test(code.slice(range.start, range.end))) {
        return undefined
      }
      return range
    })
    if (!requires || !platformApiRanges) {
      return undefined
    }
    const localRootFacts = readDenseArray<NativeNpmLocalRootFact>(raw.localRootFacts, (item) => {
      const fact = record(item)
      if (!fact) {
        return undefined
      }
      const kind = fact.kind
      const bindingName = fact.bindingName
      const referenceName = fact.referenceName
      const importee = fact.importee
      if (kind === 'require') {
        const requireIndex = fact.requireIndex
        if (typeof requireIndex !== 'number' || !Number.isSafeInteger(requireIndex)
          || requireIndex < 0 || requireIndex >= requires.length
          || (bindingName != null && typeof bindingName !== 'string')) {
          return undefined
        }
        return { kind, requireIndex, bindingName: bindingName ?? undefined }
      }
      if (kind !== 'alias' && kind !== 'interop') {
        return undefined
      }
      if ((typeof referenceName !== 'string' && typeof importee !== 'string')
        || (referenceName != null && typeof referenceName !== 'string')
        || (importee != null && typeof importee !== 'string')) {
        return undefined
      }
      const source = {
        referenceName: typeof referenceName === 'string' ? referenceName : undefined,
        importee: typeof importee === 'string' ? importee : undefined,
      }
      if (kind === 'alias') {
        return typeof bindingName === 'string' ? { kind, bindingName, ...source } : undefined
      }
      const range = readRange(fact, code, 'secondArgumentStart', 'secondArgumentEnd')
      if (!range || Number(code.slice(range.start, range.end)) !== 1) {
        return undefined
      }
      return { kind, ...source, secondArgumentStart: range.start, secondArgumentEnd: range.end }
    })
    if (!localRootFacts) {
      return undefined
    }
    const seen = new Set<number>()
    for (const fact of localRootFacts) {
      if (fact.kind === 'require') {
        if (seen.has(fact.requireIndex!)) {
          return undefined
        }
        seen.add(fact.requireIndex!)
      }
    }
    const allRanges = [...requires, ...platformApiRanges].sort((left, right) => left.start - right.start)
    if (seen.size !== requires.length
      || allRanges.some((range, index) => index > 0 && range.start < allRanges[index - 1]!.end)) {
      return undefined
    }
    return { requires, platformApiRanges, localRootFacts }
  }
  catch {
    return undefined
  }
}
