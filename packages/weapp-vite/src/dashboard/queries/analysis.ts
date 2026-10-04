import type { DashboardAnalyzeSummary, DashboardComparisonPage } from './schema'
import type { ReadDashboardQuerySnapshot } from './shared'
import { createAnalyzeBudgetCheck, createAnalyzeComparison } from '../analyze'
import { analyzeQuerySchema, comparisonQuerySchema } from './schema'
import { compareText, matchesQuery, paginate, reportTotals, selectAnalyzeReport, summarizeBudget } from './shared'

export function getAnalyzeSummary(read: ReadDashboardQuerySnapshot, input: unknown): DashboardAnalyzeSummary {
  const request = analyzeQuerySchema.parse(input)
  const { result, context, previousAvailable } = selectAnalyzeReport(read, request)
  const budgets = createAnalyzeBudgetCheck(result)
  const packageBudgets = { ok: 0, warning: 0, exceeded: 0, unknown: 0 }
  for (const budget of budgets) {
    if (budget.scope !== 'total' && budget.scope !== 'runtime') {
      packageBudgets[budget.status] += 1
    }
  }
  return {
    ...context,
    previousAvailable,
    totals: reportTotals(result),
    totalBudget: summarizeBudget(budgets.find(item => item.scope === 'total')),
    runtimeBudget: summarizeBudget(budgets.find(item => item.scope === 'runtime')),
    packageBudgets,
  }
}

export function compareAnalyzeBuilds(read: ReadDashboardQuerySnapshot, input: unknown): DashboardComparisonPage {
  const request = comparisonQuerySchema.parse(input)
  const snapshot = read(request.revision)
  const context = {
    revision: request.revision,
    currentHash: snapshot.current.descriptor.hash,
    previousHash: snapshot.previous?.descriptor.hash ?? null,
  }
  if (!snapshot.previous) {
    return { ...context, available: false, totals: null, total: 0, offset: request.offset, nextOffset: null, items: [] }
  }
  const current = snapshot.current.source
  const previous = snapshot.previous.source
  const comparison = createAnalyzeComparison(
    request.packageId === undefined ? current : { packages: current.packages.filter(pkg => pkg.id === request.packageId) },
    request.packageId === undefined ? previous : { packages: previous.packages.filter(pkg => pkg.id === request.packageId) },
  )
  const currentTotals = request.packageId === undefined ? null : reportTotals(current)
  const previousTotals = request.packageId === undefined ? null : reportTotals(previous)
  const currentUnmeasuredFiles = currentTotals?.unmeasuredFiles ?? comparison.currentUnmeasuredFiles
  const previousUnmeasuredFiles = previousTotals?.unmeasuredFiles ?? comparison.previousUnmeasuredFiles
  const currentBytes = currentUnmeasuredFiles > 0 ? null : currentTotals?.bytes ?? comparison.currentBytes
  const previousBytes = previousUnmeasuredFiles > 0 ? null : previousTotals?.bytes ?? comparison.previousBytes
  const rows = comparison[request.scope === 'package' ? 'packages' : request.scope === 'file' ? 'files' : 'modules']
  const items = rows.filter(item =>
    (request.change === undefined || item.change === request.change)
    && matchesQuery(request.query, item.label, item.file, item.moduleId, item.packageLabel),
  )
  items.sort((a, b) => (b.deltaBytes === null ? -1 : Math.abs(b.deltaBytes)) - (a.deltaBytes === null ? -1 : Math.abs(a.deltaBytes)) || compareText(a.key, b.key))
  return {
    ...context,
    available: true,
    totals: {
      currentBytes,
      previousBytes,
      deltaBytes: currentBytes === null || previousBytes === null ? null : currentBytes - previousBytes,
      currentUnmeasuredFiles,
      previousUnmeasuredFiles,
    },
    ...paginate(items, request),
  }
}
