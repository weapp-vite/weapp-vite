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
import { useAnalyzeViewActions } from './useAnalyzeViewActions'
import { useAnalyzeWorkQueue } from './useAnalyzeWorkQueue'
import { useDashboardPage } from './useDashboardPage'
import { useDashboardTheme } from './useDashboardTheme'
import { useDashboardWorkspace } from './useDashboardWorkspace'
import { useObjectInspectionNavigation } from './useObjectInspectionNavigation'

const reviewLayoutItems = [
  { id: 'review', label: 'PR 风险清单' },
]
const packagesLayoutItems = [
  { id: 'packages', label: '包与产物' },
]
const modulesLayoutItems = [
  { id: 'modules', label: '模块复用' },
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
  const inspectionNavigation = useObjectInspectionNavigation({ resultRef, activeTab })
  const treemapController = useAnalyzeTreemapController({
    activeTab,
    resultRef,
    comparisonResultRef,
    resolvedTheme,
    largestFiles: dashboardData.artifactFiles,
    duplicateModules: dashboardData.duplicateModules,
    incrementAttribution: dashboardData.incrementAttribution,
    packageInsights: dashboardData.packageInsights,
  })
  const { actionItems } = useAnalyzeActionCenter({
    resultRef,
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
    resultRef,
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
    openInspectionFile: inspectionNavigation.handleOpenInspectionFile,
    exportStatus: reportActions.exportStatus,
    setTreemapFilterMode: treemapController.setTreemapFilterMode,
    selectedTreemapMeta: treemapController.selectedTreemapMeta,
    selectedLargestFile: treemapController.selectedLargestFile,
    selectedBudgetWarning: treemapController.selectedBudgetWarning,
    handleSelectBudgetWarning: treemapController.handleSelectBudgetWarning,
  })
  const viewActions = useAnalyzeViewActions({
    exportStatus: reportActions.exportStatus,
    moreMenuOpen,
    resetPageSelection() {
      interactions.resetPageSelection()
      inspectionNavigation.resetInspectionSelection()
    },
    resetTreemapSelection: treemapController.resetTreemapSelection,
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
  const treemapComparisonLabel = computed(() => comparisonMode.value === 'baseline' ? '选定基线' : '上次构建')

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
    if (activeTab.value !== 'treemap') {
      treemapController.resetTreemapSelection()
      if (treemapController.treemapFilterMode.value === 'selected-package') {
        treemapController.treemapFilterMode.value = 'all'
      }
    }
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
    ...inspectionNavigation,
    ...reportActions,
    ...treemapController,
    ...viewActions,
    ...workQueue,
    actionItems,
    activeTab,
    activeBudgetWarningId,
    baselineSnapshotId,
    commandItems,
    comparisonMode,
    comparisonResultRef,
    historySnapshots,
    metricPackageTypeSummary,
    modulesLayoutItems,
    moreMenuOpen,
    packagesLayoutItems,
    prReviewChecklist,
    resolvedTheme,
    reviewLayoutItems,
    setBaselineSnapshot,
    setComparisonMode,
    statusPills,
    topCards,
    treemapFilterOptions,
    treemapComparisonLabel,
    resultRef,
  }
}
