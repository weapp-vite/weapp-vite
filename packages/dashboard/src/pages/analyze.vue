<script setup lang="ts">
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
  copyMarkdownReport,
  copyPrReport,
  copyPrReviewChecklist,
  copySummary,
  copyViewLink,
  copyWorkQueueReport,
  diagnosticsLayoutItems,
  exportCsv,
  exportJson,
  exportMarkdown,
  exportStatus,
  filteredDuplicateModules,
  filteredLargestFiles,
  handleAddActionToWorkQueue,
  handleFocusTreemapSelection,
  handleResetTreemapFocus,
  handleSelectAction,
  handleSelectBudgetWarning,
  handleSelectLargestFile,
  handleSelectPackageInsight,
  handleSelectReviewChecklistItem,
  handleSelectCommand,
  handleSelectWorkQueueItem,
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
  openWorkQueueItems,
  overviewLayoutItems,
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
  selectedTreemapFocusNodeId,
  selectedTreemapMeta,
  setBaselineSnapshot,
  setComparisonMode,
  sourceLayoutItems,
  statusPills,
  summary,
  toggleWorkQueueItem,
  topCards,
  treemapFilterMode,
  treemapFilterOptions,
  treemapLayoutItems,
  visibleLargestFiles,
  workQueueItems,
} = useAnalyzePageController()
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
    <AnalyzeEmptyPayloadPanel v-if="!resultRef" />

    <AnalyzeToolbar
      v-model:more-menu-open="moreMenuOpen"
      :can-reset-view="canResetView"
      :can-search="Boolean(resultRef)"
      :export-status="exportStatus"
      :open-work-queue-count="openWorkQueueItems.length"
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
      :budget-config="resultRef.metadata?.budgets"
      :budget-warnings="budgetWarnings"
      :can-use-selected-package-filter="canUseSelectedPackageFilter"
      :comparison-mode="comparisonMode"
      :copy-status="exportStatus"
      :diagnostics-layout-items="diagnosticsLayoutItems"
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
      :overview-layout-items="overviewLayoutItems"
      :package-insights="packageInsights"
      :packages-layout-items="packagesLayoutItems"
      :pr-review-checklist="prReviewChecklist"
      :queued-action-keys="queuedActionKeys"
      :review-layout-items="reviewLayoutItems"
      :selected-action-key="selectedActionKey"
      :selected-file-modules="selectedFileModules"
      :selected-treemap-focus-node-id="selectedTreemapFocusNodeId"
      :selected-treemap-meta="selectedTreemapMeta"
      :source-layout-items="sourceLayoutItems"
      :theme="resolvedTheme"
      :top-cards="topCards"
      :total-bytes="summary.totalBytes"
      :treemap-filter-mode="treemapFilterMode"
      :treemap-filter-options="treemapFilterOptions"
      :treemap-layout-items="treemapLayoutItems"
      :visible-largest-files="visibleLargestFiles"
      :work-queue-items="workQueueItems"
      @add-action-to-queue="handleAddActionToWorkQueue"
      @clear-completed-work-queue="clearCompletedWorkQueueItems"
      @copy-pr="copyPrReport"
      @copy-review-checklist="copyPrReviewChecklist"
      @copy-work-queue="copyWorkQueueReport"
      @focus-treemap-selection="handleFocusTreemapSelection"
      @remove-work-queue-item="removeWorkQueueItem"
      @reset-treemap-focus="handleResetTreemapFocus"
      @select-action="handleSelectAction"
      @select-budget-warning="handleSelectBudgetWarning"
      @select-file="handleSelectLargestFile"
      @select-package="handleSelectPackageInsight"
      @select-review-checklist-item="handleSelectReviewChecklistItem"
      @select-work-queue-item="handleSelectWorkQueueItem"
      @set-baseline="setBaselineSnapshot"
      @set-comparison-mode="setComparisonMode"
      @toggle-work-queue-item="toggleWorkQueueItem"
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
