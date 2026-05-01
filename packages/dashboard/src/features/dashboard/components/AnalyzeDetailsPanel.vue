<script setup lang="ts">
import type { AnalyzeBudgetConfig, LargestFileEntry, PackageBudgetWarning, PackageInsight, SelectedFileModuleDetail, TreemapNodeMeta } from '../types'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AnalyzeFileExplorerPanel from './AnalyzeFileExplorerPanel.vue'
import AnalyzeFileModulesPanel from './AnalyzeFileModulesPanel.vue'
import BudgetSandboxPanel from './BudgetSandboxPanel.vue'

defineProps<{
  largestFiles: LargestFileEntry[]
  selectedFileModules: SelectedFileModuleDetail[]
  budgetWarnings: PackageBudgetWarning[]
  budgetConfig?: AnalyzeBudgetConfig
  packageInsights: PackageInsight[]
  totalBytes: number
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
  selectBudgetWarning: [warning: PackageBudgetWarning]
}>()

const detailLayoutItems = [
  { id: 'top-files', label: 'Top Files', className: 'min-h-[26rem] xl:min-h-0' },
  { id: 'file-modules', label: '文件详情', className: 'min-h-[24rem] xl:min-h-0' },
  { id: 'budget', label: '预算沙盘', className: 'min-h-[24rem] xl:min-h-0' },
]
</script>

<template>
  <AnalyzeDraggableGrid
    grid-class="grid h-full min-h-0 gap-2 overflow-y-auto pr-1 xl:grid-cols-3 xl:overflow-hidden xl:pr-0"
    :items="detailLayoutItems"
    storage-key="weapp-vite:dashboard:analyze-layout:files"
  >
    <template #top-files>
      <AnalyzeFileExplorerPanel
        :largest-files="largestFiles"
        :active-largest-file-key="activeLargestFileKey"
        :selected-treemap-meta="selectedTreemapMeta"
        @select-file="emit('selectFile', $event)"
      />
    </template>

    <template #file-modules>
      <AnalyzeFileModulesPanel :selected-file-modules="selectedFileModules" />
    </template>

    <template #budget>
      <BudgetSandboxPanel
        :active-budget-warning-id="activeBudgetWarningId"
        :budget-config="budgetConfig"
        :current-warnings="budgetWarnings"
        :package-insights="packageInsights"
        :total-bytes="totalBytes"
        @select-budget-warning="emit('selectBudgetWarning', $event)"
      />
    </template>
  </AnalyzeDraggableGrid>
</template>
