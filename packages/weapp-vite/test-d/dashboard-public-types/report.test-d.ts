import type { AnalyzeSubpackagesResult } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult as AnalyzeReport } from 'weapp-vite/dashboard/analyze'
import { expectType } from 'tsd'

declare const report: AnalyzeSubpackagesResult
declare const analyzeReport: AnalyzeReport

expectType<AnalyzeReport>(report)
expectType<AnalyzeSubpackagesResult>(analyzeReport)
expectType<boolean>(report.glassEasel.detected)
expectType<'3.8.12'>(report.glassEasel.minimumBaseLibrary)
expectType<string>(report.glassEasel.migrationGuide)
expectType<number>(report.glassEasel.summary.errors)
expectType<number>(report.glassEasel.summary.warnings)
const diagnostic = report.glassEasel.diagnostics[0]!
expectType<'GE001' | 'GE002' | 'GE003' | 'GE004' | 'GE005' | 'GE006'>(diagnostic.code)
expectType<'error' | 'warning'>(diagnostic.severity)
expectType<string>(diagnostic.message)
expectType<string>(diagnostic.file)
expectType<number | undefined>(diagnostic.line)
expectType<number | undefined>(diagnostic.column)
expectType<boolean | undefined>(diagnostic.normalized)
if (report.metadata) {
  const budgets = report.metadata.budgets
  expectType<number>(budgets.totalBytes)
  expectType<number>(budgets.mainBytes)
  expectType<number>(budgets.subPackageBytes)
  expectType<number>(budgets.independentBytes)
  expectType<number | undefined>(budgets.runtimeBytes)
  expectType<Record<string, number> | undefined>(budgets.packageBytes)
  expectType<number>(budgets.warningRatio)
  expectType<'config' | 'default'>(budgets.source)
}
