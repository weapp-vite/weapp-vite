<script setup lang="ts">
import type {
  AnalyzeActionCenterItem,
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeSubpackagesResult,
  AnalyzeTreemapColorMode,
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
  TreemapLegendItem,
  TreemapNode,
  TreemapNodeMeta,
} from '../types'
import type { PrReviewChecklistItem, PrReviewChecklistSummary } from '../utils/prReviewChecklist'
import { computed, defineAsyncComponent } from 'vue'
import AnalyzeBuildSummary from './AnalyzeBuildSummary.vue'
import AnalyzeDetailsPanel from './AnalyzeDetailsPanel.vue'
import AnalyzeDiagnosticsSection from './AnalyzeDiagnosticsSection.vue'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AnalyzeWorkQueuePanel from './AnalyzeWorkQueuePanel.vue'
import ModulesPanel from './ModulesPanel.vue'
import PackagesPanel from './PackagesPanel.vue'
import PrReviewChecklistPanel from './PrReviewChecklistPanel.vue'
import SourceArtifactComparePanel from './SourceArtifactComparePanel.vue'
import TreemapCard from './TreemapCard.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  activeTab: DashboardTab
  activeWorkQueueItemId: string | null
  baselineSnapshotId: string | null
  budgetWarnings: PackageBudgetWarning[]
  canUseSelectedPackageFilter: boolean
  hasTreemapComparison: boolean
  comparisonMode: AnalyzeComparisonMode
  comparisonResult: AnalyzeSubpackagesResult | null
  copyStatus: string
  duplicateModuleScopeLabel: string | null
  duplicateModules: DuplicateModuleEntry[]
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
  packageInsights: PackageInsight[]
  packagesLayoutItems: Array<{ id: string, label: string }>
  prReviewChecklist: PrReviewChecklistSummary
  queuedActionKeys: string[]
  reviewLayoutItems: Array<{ id: string, label: string }>
  result: AnalyzeSubpackagesResult
  selectedTreemapMeta: TreemapNodeMeta | null
  selectedActionKey: string | null
  selectedFileModules: SelectedFileModuleDetail[]
  sourceLayoutItems: Array<{ id: string, label: string }>
  theme: ResolvedTheme
  topCards: DashboardMetricCard[]
  treemapColorMode: AnalyzeTreemapColorMode
  treemapColorDescription: string
  treemapComparisonLabel: string
  treemapLegend: TreemapLegendItem[]
  treemapNodes: TreemapNode[]
  treemapPath: TreemapNode[]
  treemapSourcePath: string | null
  treemapFilterMode: AnalyzeTreemapFilterMode
  treemapFilterOptions: AnalyzeTreemapFilterOption[]
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
  focusAction: [item: AnalyzeActionCenterItem]
  inspectDuplicates: [packageId: string]
  inspectTreemapProblem: [problem: 'duplicates' | 'growth']
  openFile: [item: LargestFileEntry]
  openTreemapSource: [meta: TreemapNodeMeta]
  removeWorkQueueItem: [id: string]
  resetTreemapFocus: []
  selectAction: [item: AnalyzeActionCenterItem]
  selectBudgetWarning: [item: PackageBudgetWarning]
  selectFile: [item: LargestFileEntry]
  selectPackage: [item: PackageInsight]
  selectReviewChecklistItem: [item: PrReviewChecklistItem]
  selectTreemapNode: [meta: TreemapNodeMeta]
  selectWorkQueueItem: [item: AnalyzeWorkQueueItem]
  setBaseline: [id: string]
  setComparisonMode: [mode: AnalyzeComparisonMode]
  toggleWorkQueueItem: [id: string]
  updateTreemapColorMode: [mode: AnalyzeTreemapColorMode]
  updateTreemapFilterMode: [mode: AnalyzeTreemapFilterMode]
}>()

const ChunkGraphPanel = defineAsyncComponent(() => import('./ChunkGraphPanel.vue'))
const selectedAction = computed(() => props.actionItems.find(item => item.key === props.selectedActionKey) ?? props.actionItems[0])
</script>

<template>
  <section v-if="activeTab === 'diagnostics'" class="grid min-h-0 min-w-0 content-start gap-6">
    <AnalyzeDiagnosticsSection
      :action-items="actionItems"
      :baseline-snapshot-id="baselineSnapshotId"
      :comparison-mode="comparisonMode"
      :comparison-result="comparisonResult"
      :duplicate-modules="duplicateModules"
      :increment-attribution="incrementAttribution"
      :result="result"
      :history-snapshots="historySnapshots"
      :selected-action-key="selectedActionKey"
      @focus-action="emit('focusAction', $event)"
      @open-file="emit('openFile', $event)"
      @open-source="emit('openTreemapSource', $event)"
      @select-action="emit('selectAction', $event)"
      @set-baseline="emit('setBaseline', $event)"
      @set-comparison-mode="emit('setComparisonMode', $event)"
    >
      <template #overview>
        <AnalyzeBuildSummary
          :action-items="actionItems"
          :cards="topCards"
          :largest-files="largestFiles"
          :package-insights="packageInsights"
          :package-type-summary="metricPackageTypeSummary"
          @copy-report="emit('copyPr')"
          @select-file="emit('openFile', $event)"
          @select-package="emit('selectPackage', $event)"
        />
      </template>
    </AnalyzeDiagnosticsSection>
  </section>

  <section v-else-if="activeTab === 'review'" class="min-h-0">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 min-w-0 gap-2 overflow-x-hidden overflow-y-auto xl:overflow-hidden"
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
    <details class="mt-4 border-t border-(--dashboard-border) pt-3" :open="Boolean(activeWorkQueueItemId)">
      <summary class="min-h-11 cursor-pointer py-2 text-sm text-(--dashboard-text-muted)">
        手动跟进清单<span v-if="workQueueItems.length">（{{ workQueueItems.length }} 项）</span>
      </summary>
      <p class="mb-3 text-xs leading-5 text-(--dashboard-text-soft)">仅记录本地跟进状态，不执行修复，也不证明问题已经解决。</p>
      <button v-if="selectedAction" type="button" :disabled="queuedActionKeys.includes(selectedAction.key)" class="mb-3 min-h-11 max-w-full rounded-md border border-(--dashboard-border) px-3 text-left text-sm text-(--dashboard-text-muted) [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-(--dashboard-accent) disabled:opacity-50" @click="emit('addActionToQueue', selectedAction)">
        {{ queuedActionKeys.includes(selectedAction.key) ? '已在清单：' : '加入清单：' }}{{ selectedAction.title }}
      </button>
      <AnalyzeWorkQueuePanel :items="workQueueItems" :active-id="activeWorkQueueItemId" @clear-completed="emit('clearCompletedWorkQueue')" @copy="emit('copyWorkQueue')" @remove="emit('removeWorkQueueItem', $event)" @select="emit('selectWorkQueueItem', $event)" @toggle="emit('toggleWorkQueueItem', $event)" />
    </details>
  </section>

  <section v-else-if="activeTab === 'graph'" class="min-h-0">
    <ChunkGraphPanel :result="result" :theme="theme" />
  </section>

  <section v-else-if="activeTab === 'treemap'" class="min-h-0 flex-1">
    <TreemapCard
      :bind-chart-ref="bindChartRef"
      :filter-mode="treemapFilterMode"
      :filter-options="treemapFilterOptions"
      :can-use-selected-package-filter="canUseSelectedPackageFilter"
      :has-comparison="hasTreemapComparison"
      :comparison-label="treemapComparisonLabel"
      :color-mode="treemapColorMode"
      :color-description="treemapColorDescription"
      :legend="treemapLegend"
      :nodes="treemapNodes"
      :path="treemapPath"
      :result="result"
      :selected-meta="selectedTreemapMeta"
      :is-empty="isTreemapEmpty"
      @reset-focus="emit('resetTreemapFocus')"
      @select-node="emit('selectTreemapNode', $event)"
      @open-source="emit('openTreemapSource', $event)"
      @inspect-problem="emit('inspectTreemapProblem', $event)"
      @update-color-mode="emit('updateTreemapColorMode', $event)"
      @update-filter-mode="emit('updateTreemapFilterMode', $event)"
    />
  </section>

  <section v-else-if="activeTab === 'files'" class="min-h-0">
    <AnalyzeDetailsPanel
      :largest-files="filteredLargestFiles"
      :selected-file-modules="selectedFileModules"
      :budget-warnings="budgetWarnings"
      :result="result"
      :active-budget-warning-id="activeBudgetWarningId"
      :active-largest-file-key="activeLargestFileKey"
      :selected-treemap-meta="selectedTreemapMeta"
      @select-budget-warning="emit('selectBudgetWarning', $event)"
      @select-file="emit('selectFile', $event)"
    />
  </section>

  <section v-else-if="activeTab === 'source'" class="min-h-0">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 min-w-0 gap-2 overflow-x-hidden overflow-y-auto xl:overflow-hidden"
      :items="sourceLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:source"
    >
      <template #source>
        <SourceArtifactComparePanel
          :active-file-key="activeLargestFileKey"
          :files="filteredLargestFiles"
          :theme="theme"
          :initial-source-path="treemapSourcePath"
          @select-file="emit('selectFile', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else-if="activeTab === 'packages'" class="min-h-0">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 min-w-0 gap-2 overflow-x-hidden overflow-y-auto xl:overflow-hidden"
      :items="packagesLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:packages"
    >
      <template #packages>
        <PackagesPanel
          :package-insights="packageInsights"
          :budget-warnings="budgetWarnings"
          :selected-treemap-meta="selectedTreemapMeta"
          @inspect-duplicates="emit('inspectDuplicates', $event)"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>

  <section v-else class="min-h-0">
    <AnalyzeDraggableGrid
      grid-class="grid h-full min-h-0 min-w-0 items-start gap-2 overflow-x-hidden overflow-y-auto"
      :items="modulesLayoutItems"
      storage-key="weapp-vite:dashboard:analyze-layout:modules"
    >
      <template #modules>
        <ModulesPanel
          :duplicate-modules="filteredDuplicateModules"
          :duplicate-module-scope-label="duplicateModuleScopeLabel"
          :module-source-summary="moduleSourceSummary"
          :increment-attribution="incrementAttribution"
          :increment-summary="incrementSummary"
          :visible-largest-files="visibleLargestFiles"
          @reset-scope="emit('resetTreemapFocus')"
        />
      </template>
    </AnalyzeDraggableGrid>
  </section>
</template>
