import type { NativeOnPageScrollDiagnostic, NativeScriptAnalysis } from '../native'

/** 批次形状读取失败时进入同一校验失败分支，避免漏记或重复记录回退。 */
export function isNativeScriptAnalysisBatchShape(value: unknown, expectedLength: number): value is unknown[] {
  try {
    return Array.isArray(value) && value.length === expectedLength
  }
  catch {
    return false
  }
}

function readDenseArray<T>(value: unknown, read: (item: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const length = value.length
  if (!Number.isSafeInteger(length) || length < 0) {
    return undefined
  }
  const snapshot: T[] = []
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) {
      return undefined
    }
    const item = read(value[index])
    if (item === undefined) {
      return undefined
    }
    snapshot.push(item)
  }
  return snapshot
}

function readScrollDiagnostic(value: unknown): NativeOnPageScrollDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const raw = value as Record<string, unknown>
  const kind = raw.kind
  const line = raw.line
  const column = raw.column
  const sourceLabel = raw.sourceLabel
  const syncApi = raw.syncApi
  if ((kind !== 'empty' && kind !== 'setData' && kind !== 'syncApi')
    || typeof line !== 'number' || !Number.isInteger(line) || line < 1
    || typeof column !== 'number' || !Number.isInteger(column) || column < 0
    || typeof sourceLabel !== 'string'
    || (syncApi !== undefined && typeof syncApi !== 'string')) {
    return undefined
  }
  return { kind, line, column, sourceLabel, ...(syncApi === undefined ? {} : { syncApi }) }
}

/** 读取并校验普通脚本摘要；缓存只持有自己的 plain snapshot，不保留 binding 的 getter 或 iterator。 */
export function readNativeScriptAnalysis(value: unknown): NativeScriptAnalysis | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined
    }
    const raw = value as Record<string, unknown>
    const hasStaticRequireLiteral = raw.hasStaticRequireLiteral
    const hasPlatformApiAccess = raw.hasPlatformApiAccess
    const featureFlags = readDenseArray(raw.featureFlags, flag => typeof flag === 'string' ? flag : undefined)
    const rawDiagnostics = raw.onPageScrollDiagnostics
    const diagnostics = rawDiagnostics === undefined ? undefined : readDenseArray(rawDiagnostics, readScrollDiagnostic)
    if (typeof hasStaticRequireLiteral !== 'boolean'
      || typeof hasPlatformApiAccess !== 'boolean'
      || featureFlags === undefined
      || (rawDiagnostics !== undefined && diagnostics === undefined)) {
      return undefined
    }
    return {
      hasStaticRequireLiteral,
      hasPlatformApiAccess,
      featureFlags,
      ...(diagnostics === undefined ? {} : { onPageScrollDiagnostics: diagnostics }),
    }
  }
  catch {
    return undefined
  }
}
