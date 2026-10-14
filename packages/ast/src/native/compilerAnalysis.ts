import type { NativeCompilerScriptAnalysis } from '../native'

function isUtf16Boundary(code: string, offset: number) {
  const before = code.charCodeAt(offset - 1)
  const after = code.charCodeAt(offset)
  return !(before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF)
}

/**
 * 校验可选 native binding 的摘要结构和源码范围，拒绝旧版本或不完整结果。
 */
export function isNativeCompilerScriptAnalysis(value: unknown, code: string): value is NativeCompilerScriptAnalysis {
  if (!value || typeof value !== 'object') {
    return false
  }
  const analysis = value as Partial<NativeCompilerScriptAnalysis>
  if (
    !Array.isArray(analysis.imports)
    || !Array.isArray(analysis.defineOptionsStatements)
  ) {
    return false
  }
  if (analysis.registeredComponents !== undefined
    && (!Array.isArray(analysis.registeredComponents)
      || !analysis.registeredComponents.every(component => component && typeof component === 'object'
        && typeof component.name === 'string' && typeof component.local === 'string'))) {
    return false
  }
  let previousEnd = 0
  for (const span of analysis.defineOptionsStatements) {
    if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end)
      || span.start < previousEnd || span.end <= span.start || span.end > code.length
      || !isUtf16Boundary(code, span.start) || !isUtf16Boundary(code, span.end)) {
      return false
    }
    previousEnd = span.end
  }
  return analysis.imports.every((item) => {
    if (!item || typeof item !== 'object') {
      return false
    }
    return typeof item.local === 'string'
      && typeof item.source === 'string'
      && (item.imported === undefined || typeof item.imported === 'string')
      && (item.kind === 'default' || item.kind === 'namespace' || item.kind === 'named')
      && typeof item.typeOnly === 'boolean'
  })
}
