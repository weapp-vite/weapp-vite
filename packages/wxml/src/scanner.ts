import type { ParseOptions, ScanResult } from './types'
import { normalizeOptions } from './options'
import { scanCompiledDocument } from './scannerCore'

/** 兼容根入口，扫描前解析平台预设。 */
export function scan(source: string, options: ParseOptions = {}): ScanResult {
  const { state, resolveScriptBoundary } = normalizeOptions(options)
  return scanCompiledDocument(source, state, resolveScriptBoundary, false)
}

/** 只收集普通模板注释，复用同一词法核心。 */
export function scanComments(source: string, options: ParseOptions = {}): ScanResult {
  const { state, resolveScriptBoundary } = normalizeOptions(options)
  return scanCompiledDocument(source, state, resolveScriptBoundary, false, true)
}
