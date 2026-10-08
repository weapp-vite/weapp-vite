import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { digest } from './identity'

interface Diagnostic { message: string, labels: { start: number, end: number }[] }
export interface PrinterResult {
  status: 'ok' | 'unsupported-source-type' | 'parse-error' | 'semantic-error'
  code?: string
  map?: string
  parseDiagnostics: Diagnostic[]
  semanticDiagnostics: Diagnostic[]
  unsupportedReason?: string
}

export function validatePrinterResult(raw: unknown, source: string): PrinterResult {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('Missing experimental printer result')
  }
  const result = raw as PrinterResult
  if (!['ok', 'unsupported-source-type', 'parse-error', 'semantic-error'].includes(result.status)) {
    throw new TypeError('Unknown experimental printer status')
  }
  for (const diagnostics of [result.parseDiagnostics, result.semanticDiagnostics]) {
    if (!Array.isArray(diagnostics) || !diagnostics.every(item => item && typeof item.message === 'string' && item.message.length > 0
      && Array.isArray(item.labels) && item.labels.every(label => label && Number.isSafeInteger(label.start)
        && Number.isSafeInteger(label.end) && label.start >= 0 && label.start <= label.end && label.end <= source.length))) {
      throw new TypeError('Invalid UTF-16 printer diagnostics')
    }
  }
  if (result.status === 'ok') {
    if (typeof result.code !== 'string' || typeof result.map !== 'string' || result.parseDiagnostics.length || result.semanticDiagnostics.length || result.unsupportedReason != null) {
      throw new TypeError('Invalid successful experimental printer result')
    }
  }
  else if (result.code != null || result.map != null
    || (result.status !== 'unsupported-source-type' && result.unsupportedReason != null)
    || (result.status === 'parse-error' && (result.parseDiagnostics.length === 0 || result.semanticDiagnostics.length > 0))
    || (result.status === 'semantic-error' && (result.semanticDiagnostics.length === 0 || result.parseDiagnostics.length > 0))
    || (result.status === 'unsupported-source-type' && (typeof result.unsupportedReason !== 'string' || !result.unsupportedReason || result.parseDiagnostics.length || result.semanticDiagnostics.length))) {
    throw new TypeError('Invalid failed experimental printer result')
  }
  return result
}

/** 直接读取显式实验 .node；不注册生产 native 入口，也不接受 JS wrapper。 */
export async function loadScriptPrinter(filename: string) {
  if (path.extname(filename) !== '.node' || !path.isAbsolute(filename)) {
    throw new Error('Expected an absolute experimental .node path')
  }
  const sha256 = digest(await readFile(filename))
  const module: unknown = createRequire(import.meta.url)(filename)
  if (!module || typeof module !== 'object' || !('roundTripScriptNative' in module) || typeof module.roundTripScriptNative !== 'function') {
    throw new TypeError('Binding lacks experimental-script-transform export')
  }
  const invoke = module.roundTripScriptNative as (source: string, name: string, minify: boolean) => unknown
  return { sha256, print: (source: string, name: string, minify: boolean) => validatePrinterResult(invoke(source, name, minify), source) }
}
