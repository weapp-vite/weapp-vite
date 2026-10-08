import type { TransformScriptCaptureRecord } from './captureTypes'
import type { loadScriptPrinter } from './native'
import { serializeDiagnosticError } from '../optimizedCompilerAnalysis/diagnosticError'
import { readCapturedStageResult } from './captureRead'
import { digest } from './identity'
import { inspectRoundTrip } from './oracle'
import { printerCases, rejectedPrinterCases } from './printerCases'

type Printer = Awaited<ReturnType<typeof loadScriptPrinter>>

/** 将成功 stage 的既有 JS 交给 Rust 打印；所有差异留在证据中，不替换真实编译器。 */
export function runPrinterChecks(printer: Printer, records: TransformScriptCaptureRecord[]) {
  const observations: ReturnType<typeof print>[] = []
  function print(id: string, source: string, minify: boolean, upstreamMap?: unknown) {
    const result = printer.print(source, 'inline.js', minify)
    if (result.status !== 'ok') {
      return { id, minify, inputSha256: digest(source), result, comparisonPassed: false }
    }
    try {
      const map: unknown = JSON.parse(result.map!)
      const comparison = inspectRoundTrip(source, result.code!, map, 'inline.js', upstreamMap)
      return { id, minify, inputSha256: digest(source), result, comparison, comparisonPassed: comparison.comparisonPassed }
    }
    catch (error) {
      return { id, minify, inputSha256: digest(source), result, comparisonError: serializeDiagnosticError(error), comparisonPassed: false }
    }
  }
  for (const record of records) {
    if (record.status !== 'returned') {
      continue
    }
    const result = readCapturedStageResult(record)
    for (const minify of [false, true]) {
      observations.push(print(`${record.scenarioId}/${record.callIndex}`, result.code, minify, result.map))
    }
  }
  for (const sample of printerCases) {
    for (const minify of [false, true]) {
      observations.push(print(`curated/${sample.id}`, sample.source, minify))
    }
  }
  const rejected = rejectedPrinterCases.map((sample) => {
    const result = printer.print(sample.source, sample.filename, false)
    if (result.status !== sample.status) {
      throw new Error(`Negative printer case ${sample.id}: expected ${sample.status}, got ${result.status}`)
    }
    return { id: sample.id, result }
  })
  let surrogateRejected = false
  try {
    printer.print('const value = "\uD800";', 'inline.js', false)
  }
  catch (error) {
    surrogateRejected = error instanceof Error && error.message.includes('lone UTF-16 surrogates')
    if (!surrogateRejected) {
      throw error
    }
  }
  if (!surrogateRejected) {
    throw new Error('Native printer silently accepted a lone UTF-16 surrogate')
  }
  return { observations, rejected, surrogateRejected }
}

/** 公共摘要不包含源码和整张 map；私有报告保留原始 Rust 返回供独立审核。 */
export function printerSummary(report: ReturnType<typeof runPrinterChecks>) {
  return {
    observations: report.observations.map(({ result, ...observation }) => ({
      ...observation,
      status: result.status,
      codeSha256: result.code === undefined ? undefined : digest(result.code),
      mapSha256: result.map === undefined ? undefined : digest(result.map),
      parseDiagnostics: result.parseDiagnostics,
      semanticDiagnostics: result.semanticDiagnostics,
    })),
    rejected: report.rejected,
    surrogateRejected: report.surrogateRejected,
  }
}
