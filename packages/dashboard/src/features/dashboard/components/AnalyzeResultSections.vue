<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeBudgetConfig,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeTreemapFilterMode,
  AnalyzeTreemapFilterOption,
  AnalyzeWorkQueueItem,
  DashboardMetricCard,
  DashboardTab,
  DuplicateModuleEntry,
  IncrementAttributionEntry,
  IncrementAttributionSummary,
  LargestFileEntry,
  ModuleSourceSummary,
  PackageBudgetWarning,
  PackageInsight,
  ResolvedTheme,
  SelectedFileModuleDetail,
  SummaryMetric,
  TreemapNodeMeta,
} from '../types'
import type { PrReviewChecklistItem, PrReviewChecklistSummary } from '../utils/prReviewChecklist'
import AnalyzeDetailsPanel from './AnalyzeDetailsPanel.vue'
import AnalyzeDiagnosticsSection from './AnalyzeDiagnosticsSection.vue'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AnalyzeOverviewPanel from './AnalyzeOverviewPanel.vue'
import ModulesPanel from './ModulesPanel.vue'
import PackagesPanel from './PackagesPanel.vue'
import PrReviewChecklistPanel from './PrReviewChecklistPanel.vue'
import SourceArtifactComparePanel from './SourceArtifactComparePanel.vue'
import TreemapCard from './TreemapCard.vue'

defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  activeTab: DashboardTab
  activeWorkQueueItemId: string | null
  baselineSnapshotId: string | null
  budgetConfig?: AnalyzeBudgetConfig
  budgetWarnings: PackageBudgetWarning[]
  canUseSelectedPackageFilter: boolean
  comparisonMode: AnalyzeComparisonMode
  copyStatus: string
  diagnosticsLayoutItems: Array<{ id: string, label: string }>
  filteredDuplicateModules: DuplicateModuleEntry[]
  filteredLargestFiles: LargestFileEntry[]
  historySnapshots: AnalyzeHistorySnapshot[]
  incrementAttribution: IncrementAttributionEntry[]
  incrementSummary: IncrementAttributionSummary[]
  isTreemapEmpty: boolean
  largestFiles: LargestFileEntry[]
  metricPackageTypeSummary: SummaryMetric[]
  moduleSourceSummary: ModuleSourceSummary[]
  modulesLayoutItems: Array<{ id: string, label: string }>
  overviewLayoutItems: Array<{ id: string, label: string }>
  packageInsights: PackageInsight[]
  packagesLayoutItems: Array<{ id: string, label: string }>
  prReviewChecklist: PrReviewChecklistSummary
  queuedActionKeys: string[]
  reviewLayoutItems: Array<{ id: string, label: string }>
  selectedTreemapFocusNodeId: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
  selectedActionKey: string | null
  selectedFileModules: SelectedFileModuleDetail[]
  sourceLayoutItems: Array<{ id: string, label: string }>
  theme: ResolvedTheme
  topCards: DashboardMetricCard[]
  totalBytes: number
  treemapFilterMode: AnalyzeTreemapFilterMode
  treemapFilterOptions: AnalyzeTreemapFilterOption[]
  treemapLayoutItems: Array<{ id: string, label: string }>
  visibleLargestFiles: LargestFileEntry[]
  workQueueItems: AnalyzeWorkQueueItem[]
  bindChartRef: (element: Element | null) => void
}>()

const emit = defineEmits<{
  addActionToQueue: [item: AnalyzeActionCenterItem]
  clearCompletedWorkQueue: []
  copyPr: []
  copyReviewChecklist: []
  copyWorkQueue: []
  focusTreemapSelection: []
  removeWorkQueueItem: [id: string]
  resetTreemapFocus: []
  selectAction: [item: AnalyzeActionCenterItem]
  selectBudgetWarning: [item: PackageBudgetWarning]
  selectFile: [item: LargestFileEntry]
  selectPackage: [item: PackageInsight]
  selectReviewChecklistItem: [item: PrReviewChecklistItem]
  selectWorkQueueItem: [item: AnalyzeWorkQueueItem]
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
  toggleWorkQueueItem: [id: string]
  updateTreemapFilterMode: [mode: AnalyzeTreemapFilterMode]
}>()
</script>

<template>
  <section v-if="activeTab === 'overview'" class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="overviewLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:overview"
    >
      <template #metrics>
        <AnalyzeOverviewPanel
          :action-items="actionItems"
          :cards="topCards"
          :largest-files="largestFiles"
          :package-insights="packageInsights"
          :package-type-summary="metricPackageTypeSummary"
          @copy-report="emit('copyPr')"
          @select-action="emit('selectAction', $event)"
          @select-file="emit('selectFile', $event)"
          @select-package="emit('selectPackage', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else-if="activeTab === 'diagnostics'" class="min-h-0 overflow-hidden">
    <AnalyzeDiagnosticsSection
      :action-items="actionItems"
      :active-work-queue-item-id="activeWorkQueueItemId"
      :baseline-snapshot-id="baselineSnapshotId"
      :comparison-mode="comparisonMode"
      :history-snapshots="historySnapshots"
      :layout-items="diagnosticsLayoutItems"
      :queued-action-keys="queuedActionKeys"
      :selected-action-key="selectedActionKey"
      :work-queue-items="workQueueItems"
      @add-action-to-queue="emit('addActionToQueue', $event)"
      @clear-completed-work-queue="emit('clearCompletedWorkQueue')"
      @copy-pr="emit('copyPr')"
      @copy-work-queue="emit('copyWorkQueue')"
      @remove-work-queue-item="emit('removeWorkQueueItem', $event)"
      @select-action="emit('selectAction', $event)"
      @select-work-queue-item="emit('selectWorkQueueItem', $event)"
      @set-baseline="emit('setBaseline', $event)"
      @set-comparison-mode="emit('setComparisonMode', $event)"
      @toggle-work-queue-item="emit('toggleWorkQueueItem', $event)"
    />
  </section>

  <section v-else-if="activeTab === 'review'" class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="reviewLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:review"
    >
      <template #review>
        <PrReviewChecklistPanel
          :checklist="prReviewChecklist"
          :copy-status="copyStatus"
          @copy="emit('copyReviewChecklist')"
          @select="emit('selectReviewChecklistItem', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else-if="activeTab === 'treemap'" class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="treemapLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:treemap"
    >
      <template #treemap>
        <TreemapCard
          :bind-chart-ref="bindChartRef"
          :can-focus-selected="Boolean(selectedTreemapFocusNodeId)"
          :filter-mode="treemapFilterMode"
          :filter-options="treemapFilterOptions"
          :can-use-selected-package-filter="canUseSelectedPackageFilter"
          :is-empty="isTreemapEmpty"
          :theme="theme"
          @focus-selected="emit('focusTreemapSelection')"
          @reset-focus="emit('resetTreemapFocus')"
          @update-filter-mode="emit('updateTreemapFilterMode', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else-if="activeTab === 'files'" class="min-h-0 overflow-hidden">
    <AnalyzeDetailsPanel
      :largest-files="filteredLargestFiles"
      :selected-file-modules="selectedFileModules"
      :budget-warnings="budgetWarnings"
      :budget-config="budgetConfig"
      :package-insights="packageInsights"
      :total-bytes="totalBytes"
      :active-budget-warning-id="activeBudgetWarningId"
      :active-largest-file-key="activeLargestFileKey"
      :selected-treemap-meta="selectedTreemapMeta"
      @select-budget-warning="emit('selectBudgetWarning', $event)"
      @select-file="emit('selectFile', $event)"
    />
  </section>

  <section v-else-if="activeTab === 'source'" class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="sourceLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:source"
    >
      <template #source>
        <SourceArtifactComparePanel
          :active-file-key="activeLargestFileKey"
          :files="filteredLargestFiles"
          :theme="theme"
          @select-file="emit('selectFile', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else-if="activeTab === 'packages'" class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="packagesLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:packages"
    >
      <template #packages>
        <PackagesPanel
          :package-insights="packageInsights"
          :budget-warnings="budgetWarnings"
          :selected-treemap-meta="selectedTreemapMeta"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else class="min-h-0 overflow-hidden">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 gap-2 overflow-hidden"
      :items="modulesLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:modules"
    >
      <template #modules>
        <ModulesPanel
          :duplicate-modules="filteredDuplicateModules"
          :module-source-summary="moduleSourceSummary"
          :increment-attribution="incrementAttribution"
          :increment-summary="incrementSummary"
          :visible-largest-files="visibleLargestFiles"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>
</template>
