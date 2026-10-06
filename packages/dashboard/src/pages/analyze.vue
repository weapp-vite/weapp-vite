<script setup lang="ts">
import { computed } from 'vue'
import AnalyzeCommandPalette from '../features/dashboard/components/AnalyzeCommandPalette.vue'
import AnalyzeEmptyPayloadPanel from '../features/dashboard/components/AnalyzeEmptyPayloadPanel.vue'
import AnalyzeResultSections from '../features/dashboard/components/AnalyzeResultSections.vue'
import AnalyzeToolbar from '../features/dashboard/components/AnalyzeToolbar.vue'
import { useAnalyzePageController } from '../features/dashboard/composables/useAnalyzePageController'

const {
  actionItems,
  activeBudgetWarningId,
  activeLargestFileKey,
  activeTab,
  activeWorkQueueItemId,
  baselineSnapshotId,
  bindChartRef,
  budgetWarnings,
  canUseSelectedPackageFilter,
  canResetView,
  clearCompletedWorkQueueItems,
  commandItems,
  commandPaletteOpen,
  comparisonMode,
  comparisonResultRef,
  copyMarkdownReport,
  copyPrReport,
  copyPrReviewChecklist,
  copySummary,
  copyViewLink,
  copyWorkQueueReport,
  duplicateModuleScopeLabel,
  duplicateModules,
  exportCsv,
  exportJson,
  exportMarkdown,
  exportStatus,
  filteredDuplicateModules,
  filteredLargestFiles,
  handleAddActionToWorkQueue,
  handleFocusAction,
  handleInspectPackageDuplicates,
  handleInspectTreemapProblem,
  handleOpenFile,
  handleOpenTreemapSource,
  handleResetTreemapFocus,
  handleSelectAction,
  handleSelectBudgetWarning,
  handleSelectLargestFile,
  handleSelectPackageInsight,
  handleSelectReviewChecklistItem,
  handleSelectCommand,
  handleSelectTreemapNode,
  handleSelectWorkQueueItem,
  handleUpdateTreemapColorMode,
  hasTreemapComparison,
  handleUpdateTreemapFilterMode,
  historySnapshots,
  incrementAttribution,
  incrementSummary,
  isTreemapEmpty,
  largestFiles,
  metricPackageTypeSummary,
  modulesLayoutItems,
  moduleSourceSummary,
  moreMenuOpen,
  packageInsights,
  packagesLayoutItems,
  prReviewChecklist,
  queuedActionKeys,
  removeWorkQueueItem,
  resetAnalyzeView,
  resolvedTheme,
  resultRef,
  reviewLayoutItems,
  selectedActionKey,
  selectedFileModules,
  selectedTreemapMeta,
  setBaselineSnapshot,
  setComparisonMode,
  sourceLayoutItems,
  statusPills,
  toggleWorkQueueItem,
  topCards,
  treemapColorMode,
  treemapColorDescription,
  treemapComparisonLabel,
  treemapLegend,
  treemapNodes,
  treemapPath,
  treemapSourcePath,
  treemapFilterMode,
  treemapFilterOptions,
  visibleLargestFiles,
  workQueueItems,
} = useAnalyzePageController()

const pageClassName = computed(() => {
  if (activeTab.value === 'treemap' && resultRef.value) {
    return 'flex h-full min-h-0 flex-col gap-2'
  }
  if (!resultRef.value || activeTab.value === 'diagnostics') {
    return 'grid min-w-0 content-start gap-4'
  }
  return 'grid min-h-[calc(100dvh-8rem)] grid-rows-[auto_minmax(44rem,1fr)] gap-4'
})
</script>

<template>
  <div :class="pageClassName">
    <AnalyzeEmptyPayloadPanel v-if="!resultRef" />

    <AnalyzeToolbar
      v-model:more-menu-open="moreMenuOpen"
      :can-reset-view="canResetView"
      :can-search="Boolean(resultRef)"
      :export-status="exportStatus"
      :status-pills="statusPills"
      @copy-markdown="copyMarkdownReport"
      @copy-pr="copyPrReport"
      @copy-summary="copySummary"
      @copy-view-link="copyViewLink"
      @export-csv="exportCsv"
      @export-json="exportJson"
      @export-markdown="exportMarkdown"
      @open-search="commandPaletteOpen = true"
      @reset-view="resetAnalyzeView"
    />

    <AnalyzeResultSections
      v-if="resultRef"
      :action-items="actionItems"
      :active-budget-warning-id="activeBudgetWarningId"
      :active-largest-file-key="activeLargestFileKey"
      :active-tab="activeTab"
      :active-work-queue-item-id="activeWorkQueueItemId"
      :baseline-snapshot-id="baselineSnapshotId"
      :bind-chart-ref="bindChartRef"
      :budget-warnings="budgetWarnings"
      :can-use-selected-package-filter="canUseSelectedPackageFilter"
      :comparison-mode="comparisonMode"
      :comparison-result="comparisonResultRef"
      :has-treemap-comparison="hasTreemapComparison"
      :copy-status="exportStatus"
      :duplicate-module-scope-label="duplicateModuleScopeLabel"
      :duplicate-modules="duplicateModules"
      :filtered-duplicate-modules="filteredDuplicateModules"
      :filtered-largest-files="filteredLargestFiles"
      :history-snapshots="historySnapshots"
      :increment-attribution="incrementAttribution"
      :increment-summary="incrementSummary"
      :is-treemap-empty="isTreemapEmpty"
      :largest-files="largestFiles"
      :metric-package-type-summary="metricPackageTypeSummary"
      :modules-layout-items="modulesLayoutItems"
      :module-source-summary="moduleSourceSummary"
      :package-insights="packageInsights"
      :packages-layout-items="packagesLayoutItems"
      :pr-review-checklist="prReviewChecklist"
      :queued-action-keys="queuedActionKeys"
      :review-layout-items="reviewLayoutItems"
      :result="resultRef"
      :selected-action-key="selectedActionKey"
      :selected-file-modules="selectedFileModules"
      :selected-treemap-meta="selectedTreemapMeta"
      :source-layout-items="sourceLayoutItems"
      :theme="resolvedTheme"
      :top-cards="topCards"
      :treemap-color-mode="treemapColorMode"
      :treemap-color-description="treemapColorDescription"
      :treemap-comparison-label="treemapComparisonLabel"
      :treemap-legend="treemapLegend"
      :treemap-nodes="treemapNodes"
      :treemap-path="treemapPath"
      :treemap-source-path="treemapSourcePath"
      :treemap-filter-mode="treemapFilterMode"
      :treemap-filter-options="treemapFilterOptions"
      :visible-largest-files="visibleLargestFiles"
      :work-queue-items="workQueueItems"
      @add-action-to-queue="handleAddActionToWorkQueue"
      @clear-completed-work-queue="clearCompletedWorkQueueItems"
      @copy-pr="copyPrReport"
      @copy-review-checklist="copyPrReviewChecklist"
      @copy-work-queue="copyWorkQueueReport"
      @focus-action="handleFocusAction"
      @inspect-duplicates="handleInspectPackageDuplicates"
      @inspect-treemap-problem="handleInspectTreemapProblem"
      @open-file="handleOpenFile"
      @open-treemap-source="handleOpenTreemapSource"
      @remove-work-queue-item="removeWorkQueueItem"
      @reset-treemap-focus="handleResetTreemapFocus"
      @select-action="handleSelectAction"
      @select-budget-warning="handleSelectBudgetWarning"
      @select-file="handleSelectLargestFile"
      @select-package="handleSelectPackageInsight"
      @select-treemap-node="handleSelectTreemapNode"
      @select-review-checklist-item="handleSelectReviewChecklistItem"
      @select-work-queue-item="handleSelectWorkQueueItem"
      @set-baseline="setBaselineSnapshot"
      @set-comparison-mode="setComparisonMode"
      @toggle-work-queue-item="toggleWorkQueueItem"
      @update-treemap-color-mode="handleUpdateTreemapColorMode"
      @update-treemap-filter-mode="handleUpdateTreemapFilterMode"
    />

    <AnalyzeCommandPalette
      :open="Boolean(resultRef && commandPaletteOpen)"
      :items="commandItems"
      @close="commandPaletteOpen = false"
      @select="handleSelectCommand"
    />
  </div>
</template>
