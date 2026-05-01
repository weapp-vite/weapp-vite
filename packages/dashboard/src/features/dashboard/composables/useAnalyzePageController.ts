import type { DashboardInfoPillItem } from '../types'
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { treemapFilterOptions } from '../constants/view'
import { createPrReviewChecklistSummary } from '../utils/prReviewChecklist'
import { useAnalyzeActionCenter } from './useAnalyzeActionCenter'
import { useAnalyzeCommandPalette } from './useAnalyzeCommandPalette'
import { useAnalyzeDashboardData } from './useAnalyzeDashboardData'
import { useAnalyzePageInteractions } from './useAnalyzePageInteractions'
import { useAnalyzeReportActions } from './useAnalyzeReportActions'
import { useAnalyzeTreemapController } from './useAnalyzeTreemapController'
import { useAnalyzeWorkQueue } from './useAnalyzeWorkQueue'
import { useDashboardPage } from './useDashboardPage'
import { useDashboardTheme } from './useDashboardTheme'
import { useDashboardWorkspace } from './useDashboardWorkspace'

const overviewLayoutItems = [
  { id: 'metrics', label: '关键指标' },
]
const diagnosticsLayoutItems = [
  { id: 'actions', label: '问题中心' },
  { id: 'work-queue', label: '处理清单' },
  { id: 'history', label: '历史基线' },
]
const reviewLayoutItems = [
  { id: 'review', label: 'PR 风险清单' },
]
const treemapLayoutItems = [
  { id: 'treemap', label: '体积地图' },
]
const packagesLayoutItems = [
  { id: 'packages', label: '包与产物' },
]
const modulesLayoutItems = [
  { id: 'modules', label: '模块复用' },
]
const sourceLayoutItems = [
  { id: 'source', label: '源码对比' },
]

export function useAnalyzePageController() {
  const moreMenuOpen = shallowRef(false)
  const { resolvedTheme } = useDashboardTheme()
  const {
    baselineSnapshotId,
    comparisonMode,
    comparisonResultRef,
    historySnapshots,
    lastUpdatedAt,
    resultRef,
    setBaselineSnapshot,
    setComparisonMode,
    updateCount,
  } = useDashboardWorkspace()

  const dashboardData = useAnalyzeDashboardData(resultRef, comparisonResultRef)
  const { activeTab, topCards, packageTypeSummary: metricPackageTypeSummary } = useDashboardPage({
    summary: dashboardData.summary,
    packageInsights: dashboardData.packageInsights,
    packageTypeSummary: dashboardData.packageTypeSummary,
    duplicateModules: dashboardData.duplicateModules,
    moduleSourceSummary: dashboardData.moduleSourceSummary,
    lastUpdatedAt,
  })
  const treemapController = useAnalyzeTreemapController({
    activeTab,
    resultRef,
    resolvedTheme,
    largestFiles: dashboardData.largestFiles,
    duplicateModules: dashboardData.duplicateModules,
    incrementAttribution: dashboardData.incrementAttribution,
    packageInsights: dashboardData.packageInsights,
  })
  const { actionItems } = useAnalyzeActionCenter({
    budgetWarnings: dashboardData.budgetWarnings,
    incrementAttribution: dashboardData.incrementAttribution,
    duplicateModules: dashboardData.duplicateModules,
    largestFiles: dashboardData.largestFiles,
    packageInsights: dashboardData.packageInsights,
  })
  const workQueue = useAnalyzeWorkQueue()
  const prReviewChecklist = computed(() => createPrReviewChecklistSummary({
    actionItems: actionItems.value,
    workQueueItems: workQueue.workQueueItems.value,
  }))
  const { commandItems } = useAnalyzeCommandPalette({
    actionItems,
    budgetWarnings: dashboardData.budgetWarnings,
    duplicateModules: dashboardData.duplicateModules,
    incrementAttribution: dashboardData.incrementAttribution,
    largestFiles: dashboardData.largestFiles,
    packageInsights: dashboardData.packageInsights,
  })
  const reportActions = useAnalyzeReportActions({
    resultRef,
    summary: dashboardData.summary,
    packageInsights: dashboardData.packageInsights,
    largestFiles: dashboardData.largestFiles,
    duplicateModules: dashboardData.duplicateModules,
    budgetWarnings: dashboardData.budgetWarnings,
    incrementAttribution: dashboardData.incrementAttribution,
    incrementSummary: dashboardData.incrementSummary,
    prReviewChecklist,
    workQueueItems: workQueue.workQueueItems,
    moreMenuOpen,
  })
  const interactions = useAnalyzePageInteractions({
    activeTab,
    actionItems,
    workQueueItems: workQueue.workQueueItems,
    addWorkQueueItem: workQueue.addWorkQueueItem,
    exportStatus: reportActions.exportStatus,
    treemapFilterMode: treemapController.treemapFilterMode,
    selectedTreemapMeta: treemapController.selectedTreemapMeta,
    selectedLargestFile: treemapController.selectedLargestFile,
    selectedBudgetWarning: treemapController.selectedBudgetWarning,
    handleSelectBudgetWarning: treemapController.handleSelectBudgetWarning,
    handleSelectLargestFile: treemapController.handleSelectLargestFile,
  })

  const statusText = computed(() => `${updateCount.value} 次数据同步`)
  const statusTone = computed(() => resolvedTheme.value === 'dark' ? 'status-dark' : 'status-light')
  const statusPills = computed<DashboardInfoPillItem[]>(() => [
    {
      iconName: statusTone.value,
      label: statusText.value,
    },
    {
      label: lastUpdatedAt.value,
    },
  ])
  const activeBudgetWarningId = computed(() => treemapController.selectedBudgetWarning.value?.id ?? null)

  function handlePageClick() {
    moreMenuOpen.value = false
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      moreMenuOpen.value = false
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      if (resultRef.value) {
        interactions.commandPaletteOpen.value = true
      }
    }
  }

  watch(resultRef, () => {
    treemapController.resetTreemapSelection()
    interactions.resetPageSelection()
  })

  onMounted(() => {
    window.addEventListener('resize', treemapController.handleResize)
    window.addEventListener('keydown', handleGlobalKeydown)
    window.addEventListener('click', handlePageClick)
    void treemapController.ensureChart()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', treemapController.handleResize)
    window.removeEventListener('keydown', handleGlobalKeydown)
    window.removeEventListener('click', handlePageClick)
    treemapController.destroyChart()
  })

  return {
    ...dashboardData,
    ...interactions,
    ...reportActions,
    ...treemapController,
    ...workQueue,
    actionItems,
    activeTab,
    activeBudgetWarningId,
    baselineSnapshotId,
    commandItems,
    comparisonMode,
    diagnosticsLayoutItems,
    historySnapshots,
    metricPackageTypeSummary,
    modulesLayoutItems,
    moreMenuOpen,
    overviewLayoutItems,
    packagesLayoutItems,
    prReviewChecklist,
    resolvedTheme,
    reviewLayoutItems,
    setBaselineSnapshot,
    setComparisonMode,
    sourceLayoutItems,
    statusPills,
    topCards,
    treemapFilterOptions,
    treemapLayoutItems,
    resultRef,
  }
}
