import type { AnalyzeBudgetCheckItem, AnalyzeComparison, AnalyzeSizeChange, AnalyzeSubpackagesResult, DuplicateModuleInsight } from 'weapp-vite/dashboard/analyze'
import { expectError, expectType } from 'tsd'
import { createAnalyzeBudgetCheck, createAnalyzeComparison, createDuplicateModuleInsights } from 'weapp-vite/dashboard/analyze'

declare const fullReport: AnalyzeSubpackagesResult

const browserReport = {
  packages: [{
    id: 'main',
    label: '主包',
    type: 'main' as const,
    files: [{
      file: 'app.js',
      type: 'chunk' as const,
      from: 'main' as const,
      size: 120,
      modules: [{ id: 'app', source: 'app.ts', sourceType: 'src' as const, bytes: 80 }],
    }],
  }],
  modules: [{ id: 'app', source: 'app.ts', sourceType: 'src' as const, packages: [{ packageId: 'main', files: ['app.js'] }] }],
  subPackages: [],
}

expectType<AnalyzeBudgetCheckItem[]>(createAnalyzeBudgetCheck(browserReport))
expectType<AnalyzeBudgetCheckItem[]>(createAnalyzeBudgetCheck({
  packages: fullReport.packages,
  metadata: { budgets: fullReport.metadata!.budgets },
}))
expectType<AnalyzeBudgetCheckItem[]>(createAnalyzeBudgetCheck({
  packages: fullReport.packages,
  metadata: {
    budgets: fullReport.metadata!.budgets,
    generatedAt: '',
    history: { enabled: false, dir: '', limit: 0 },
  },
}))
expectType<DuplicateModuleInsight[]>(createDuplicateModuleInsights(browserReport))
expectType<AnalyzeComparison>(createAnalyzeComparison(browserReport, fullReport))
expectType<AnalyzeComparison>(createAnalyzeComparison(fullReport, browserReport))
expectType<AnalyzeSizeChange[]>(createAnalyzeComparison(browserReport, fullReport).modules)
expectType<boolean>(createDuplicateModuleInsights(browserReport)[0]!.hasIndependentPackage)
expectType<'added' | 'removed' | 'increased' | 'decreased' | 'unmeasured'>(createAnalyzeComparison(browserReport, fullReport).files[0]!.change)
expectType<number | null>(createAnalyzeComparison(browserReport, fullReport).deltaBytes)
expectType<number>(createAnalyzeComparison(browserReport, fullReport).currentUnmeasuredFiles)
expectType<number | null>(createAnalyzeComparison(browserReport, fullReport).modules[0]!.currentBytes)

expectError(createAnalyzeComparison(browserReport))
expectError(createAnalyzeComparison(browserReport, null))
expectError(createAnalyzeBudgetCheck({ packages: [{ ...browserReport.packages[0]!, type: 'unknown' }] }))
expectError(createDuplicateModuleInsights({ packages: browserReport.packages }))
