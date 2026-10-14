import type { AnalyzeSubpackagesResult } from 'weapp-vite/dashboard'
import type { AnalyzeBudgetCheckItem, AnalyzeSubpackagesResult as AnalyzeReport } from 'weapp-vite/dashboard/analyze'
import { createAnalyzeBudgetCheck } from 'weapp-vite/dashboard/analyze'

function reportContract(report: AnalyzeSubpackagesResult): AnalyzeReport {
  const minimumBaseLibrary: '3.8.12' = report.glassEasel.minimumBaseLibrary
  const diagnostics: Array<{ code: 'GE001' | 'GE002' | 'GE003' | 'GE004' | 'GE005' | 'GE006', severity: 'error' | 'warning', message: string, file: string }> = report.glassEasel.diagnostics
  const budgets: AnalyzeBudgetCheckItem[] = createAnalyzeBudgetCheck(report)
  void minimumBaseLibrary
  void diagnostics
  void budgets
  return report
}
void reportContract
