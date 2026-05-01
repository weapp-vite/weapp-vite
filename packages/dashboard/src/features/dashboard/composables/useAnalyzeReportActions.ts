import type { Ref } from 'vue'
import type {
  AnalyzeDashboardSummary,
  AnalyzeSubpackagesResult,
  AnalyzeWorkQueueItem,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  PackageBudgetWarning,
  PackageInsight,
} from '../types'
import type { PrReviewChecklistSummary } from '../utils/prReviewChecklist'
import { computed, shallowRef } from 'vue'
import { createAnalyzeCsvReport, createAnalyzeMarkdownReport, createAnalyzePrMarkdownReport, createAnalyzeSummaryText } from '../utils/analyzeExportReports'
import { copyText } from '../utils/clipboard'
import { createWorkQueueMarkdown } from '../utils/workQueue'

function downloadTextFile(options: {
  content: string
  filename: string
  type: string
}) {
  const blob = new Blob([`${options.content}\n`], { type: options.type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = options.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function useAnalyzeReportActions(options: {
  resultRef: Ref<AnalyzeSubpackagesResult | null>
  summary: Ref<AnalyzeDashboardSummary>
  packageInsights: Ref<PackageInsight[]>
  largestFiles: Ref<LargestFileEntry[]>
  duplicateModules: Ref<DuplicateModuleEntry[]>
  budgetWarnings: Ref<PackageBudgetWarning[]>
  incrementAttribution: Ref<IncrementAttributionEntry[]>
  incrementSummary: Ref<IncrementAttributionSummary[]>
  prReviewChecklist: Ref<PrReviewChecklistSummary>
  workQueueItems: Ref<AnalyzeWorkQueueItem[]>
  moreMenuOpen: Ref<boolean>
}) {
  const exportStatus = shallowRef('')

  const exportSummaryText = computed(() => createAnalyzeSummaryText({
    summary: options.summary.value,
    packageInsights: options.packageInsights.value,
    duplicateModules: options.duplicateModules.value,
  }))

  const exportMarkdownText = computed(() => createAnalyzeMarkdownReport({
    generatedAt: options.resultRef.value?.metadata?.generatedAt,
    summary: options.summary.value,
    packageInsights: options.packageInsights.value,
    largestFiles: options.largestFiles.value,
    duplicateModules: options.duplicateModules.value,
    budgetWarnings: options.budgetWarnings.value,
  }))

  const exportPrMarkdownText = computed(() => createAnalyzePrMarkdownReport({
    summary: options.summary.value,
    incrementAttribution: options.incrementAttribution.value,
    incrementSummary: options.incrementSummary.value,
    budgetWarnings: options.budgetWarnings.value,
    duplicateModules: options.duplicateModules.value,
  }))

  const exportCsvText = computed(() => createAnalyzeCsvReport({
    packageInsights: options.packageInsights.value,
    largestFiles: options.largestFiles.value,
    duplicateModules: options.duplicateModules.value,
    incrementAttribution: options.incrementAttribution.value,
  }))

  async function copySummary() {
    await copyText(exportSummaryText.value)
    exportStatus.value = '已复制'
    options.moreMenuOpen.value = false
  }

  async function copyMarkdownReport() {
    await copyText(exportMarkdownText.value)
    exportStatus.value = '报告已复制'
    options.moreMenuOpen.value = false
  }

  async function copyPrReport() {
    await copyText(exportPrMarkdownText.value)
    exportStatus.value = 'PR 摘要已复制'
    options.moreMenuOpen.value = false
  }

  async function copyPrReviewChecklist() {
    await copyText(options.prReviewChecklist.value.report)
    exportStatus.value = '评审清单已复制'
  }

  async function copyWorkQueueReport() {
    await copyText(createWorkQueueMarkdown(options.workQueueItems.value))
    exportStatus.value = '处理清单已复制'
  }

  function exportJson() {
    if (!options.resultRef.value) {
      return
    }
    downloadTextFile({
      content: JSON.stringify(options.resultRef.value, null, 2),
      filename: 'weapp-vite-analyze.json',
      type: 'application/json',
    })
    exportStatus.value = '已导出'
    options.moreMenuOpen.value = false
  }

  function exportMarkdown() {
    downloadTextFile({
      content: exportMarkdownText.value,
      filename: 'weapp-vite-analyze.md',
      type: 'text/markdown',
    })
    exportStatus.value = '已导出 MD'
    options.moreMenuOpen.value = false
  }

  function exportCsv() {
    downloadTextFile({
      content: exportCsvText.value,
      filename: 'weapp-vite-analyze.csv',
      type: 'text/csv;charset=utf-8',
    })
    exportStatus.value = '已导出 CSV'
    options.moreMenuOpen.value = false
  }

  return {
    exportStatus,
    copyMarkdownReport,
    copyPrReport,
    copyPrReviewChecklist,
    copySummary,
    copyWorkQueueReport,
    exportCsv,
    exportJson,
    exportMarkdown,
  }
}
