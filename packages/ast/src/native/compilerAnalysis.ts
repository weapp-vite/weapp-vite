import type { NativeCompilerRegisteredComponent, NativeCompilerScriptAnalysis, NativeCompilerScriptImport, NativeCompilerScriptSpan } from '../native'

function isUtf16Boundary(code: string, offset: number) {
  const before = code.charCodeAt(offset - 1)
  const after = code.charCodeAt(offset)
  return !(before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF)
}

function readDenseArray<T>(value: unknown, read: (item: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const length = value.length
  if (!Number.isSafeInteger(length) || length < 0) {
    return undefined
  }
  const items: T[] = []
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) {
      return undefined
    }
    const item = read(value[index])
    if (item === undefined) {
      return undefined
    }
    items.push(item)
  }
  return items
}

function readImport(value: unknown): NativeCompilerScriptImport | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const raw = value as Record<string, unknown>
  const local = raw.local
  const imported = raw.imported
  const source = raw.source
  const kind = raw.kind
  const typeOnly = raw.typeOnly
  if (typeof local !== 'string' || typeof source !== 'string' || typeof typeOnly !== 'boolean'
    || (imported !== undefined && typeof imported !== 'string')
    || (kind !== 'default' && kind !== 'namespace' && kind !== 'named')) {
    return undefined
  }
  return { local, source, kind, typeOnly, ...(imported === undefined ? {} : { imported }) }
}

function readComponent(value: unknown): NativeCompilerRegisteredComponent | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const raw = value as Record<string, unknown>
  const name = raw.name
  const local = raw.local
  return typeof name === 'string' && typeof local === 'string' ? { name, local } : undefined
}

/** 只保留校验后的自有摘要，不把可选 binding 的 getter 或可变容器传到编译阶段。 */
export function readNativeCompilerScriptAnalysis(value: unknown, code: string): NativeCompilerScriptAnalysis | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    const raw = value as Record<string, unknown>
    const imports = readDenseArray(raw.imports, readImport)
    const hasDefaultExport = raw.hasDefaultExport
    let previousEnd = 0
    const defineOptionsStatements = readDenseArray<NativeCompilerScriptSpan>(raw.defineOptionsStatements, (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
      }
      const span = value as Record<string, unknown>
      const start = span.start
      const end = span.end
      if (typeof start !== 'number' || typeof end !== 'number'
        || !Number.isInteger(start) || !Number.isInteger(end)
        || start < previousEnd || end <= start || end > code.length
        || !isUtf16Boundary(code, start) || !isUtf16Boundary(code, end)) {
        return undefined
      }
      previousEnd = end
      return { start, end }
    })
    const rawComponents = raw.registeredComponents
    const registeredComponents = rawComponents === undefined ? undefined : readDenseArray(rawComponents, readComponent)
    if (imports === undefined || defineOptionsStatements === undefined
      || (hasDefaultExport !== undefined && typeof hasDefaultExport !== 'boolean')
      || (rawComponents !== undefined && registeredComponents === undefined)) {
      return undefined
    }
    const rawDiagnostic = raw.reservedPropsDiagnostic
    let reservedPropsDiagnostic: NativeCompilerScriptAnalysis['reservedPropsDiagnostic']
    if (rawDiagnostic !== undefined) {
      if (!rawDiagnostic || typeof rawDiagnostic !== 'object' || Array.isArray(rawDiagnostic)) {
        return undefined
      }
      const warningOffset = (rawDiagnostic as Record<string, unknown>).warningOffset
      if (warningOffset !== undefined && (typeof warningOffset !== 'number'
        || !Number.isInteger(warningOffset) || warningOffset < 0 || warningOffset >= code.length
        || !isUtf16Boundary(code, warningOffset))) {
        return undefined
      }
      reservedPropsDiagnostic = warningOffset === undefined ? {} : { warningOffset }
    }
    return {
      imports,
      ...(hasDefaultExport === undefined ? {} : { hasDefaultExport }),
      defineOptionsStatements,
      ...(registeredComponents === undefined ? {} : { registeredComponents }),
      ...(reservedPropsDiagnostic === undefined ? {} : { reservedPropsDiagnostic }),
    }
  }
  catch {
    return undefined
  }
}
