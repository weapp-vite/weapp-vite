import type { AnalyzeSubpackagesResult } from 'weapp-vite/dashboard'
import { expectAssignable, expectType } from 'tsd'

declare const report: AnalyzeSubpackagesResult
expectType<2 | undefined>(report.schemaVersion)
expectAssignable<{ id: string, platform: string, mode: string } | undefined>(report.build)
if (report.artifacts) {
  expectType<number>(report.artifacts.totalBytes)
  expectType<number>(report.artifacts.runtime.upperBoundBytes)
  expectType<string[]>(report.artifacts.runtime.unknownFiles)
  expectType<number>(report.artifacts.files[0]!.unattributedBytes)
}
if (report.budgetChecks) {
  expectType<'ok' | 'warning' | 'exceeded' | 'unknown'>(report.budgetChecks[0]!.status)
  expectType<'file-bytes' | 'upper-bound' | 'unavailable'>(report.budgetChecks[0]!.measurement)
}
