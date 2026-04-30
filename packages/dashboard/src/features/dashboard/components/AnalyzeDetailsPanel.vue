<script setup lang="ts">
import type { DashboardDetailItem, LargestFileEntry, PackageBudgetLimitItem, PackageBudgetWarning, SelectedFileModuleDetail, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatBytes } from '../utils/format'
import AnalyzeDraggableGrid from './AnalyzeDraggableGrid.vue'
import AnalyzeFileExplorerPanel from './AnalyzeFileExplorerPanel.vue'
import AnalyzeFileModulesPanel from './AnalyzeFileModulesPanel.vue'
import AppCompactListItem from './AppCompactListItem.vue'

const props = defineProps<{
  largestFiles: LargestFileEntry[]
  selectedFileModules: SelectedFileModuleDetail[]
  budgetWarnings: PackageBudgetWarning[]
  budgetLimitItems: PackageBudgetLimitItem[]
  activeBudgetWarningId: string | null
  activeLargestFileKey: string | null
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const emit = defineEmits<{
  selectFile: [file: LargestFileEntry]
  selectBudgetWarning: [warning: PackageBudgetWarning]
}>()

const detailLayoutItems = [
  { id: 'top-files', label: 'Top Files' },
  { id: 'file-modules', label: '文件详情' },
  { id: 'budget', label: '预算' },
]

function createBudgetItem(item: PackageBudgetWarning): DashboardDetailItem {
  return {
    title: item.label,
    meta: `${item.status === 'critical' ? '已超预算' : '接近预算'} · ${(item.ratio * 100).toFixed(1)}%`,
    value: `${formatBytes(item.currentBytes)} / ${formatBytes(item.limitBytes)}`,
  }
}

const budgetItems = computed(() => props.budgetWarnings.slice(0, 6).map(item => ({
  key: item.id,
  warning: item,
  active: props.activeBudgetWarningId === item.id,
  ...createBudgetItem(item),
})))

const budgetLimitItems = computed(() => props.budgetLimitItems.map(item => ({
  key: item.key,
  title: item.label,
  meta: item.source === 'config' ? '来自配置' : '默认阈值',
  value: item.value,
})))
</script>

<template>
  <AnalyzeDraggableGrid
    grid-class="grid h-full min-h-0 gap-2 overflow-hidden xl:grid-cols-3"
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
      <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-3 shadow-(--dashboard-shadow)">
        <div class="mb-2 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">
            预算
          </h3>
          <span class="text-[11px] uppercase tracking-[0.16em] text-(--dashboard-text-soft)">limits</span>
        </div>
        <ul class="grid min-h-0 gap-2 overflow-y-auto pr-1 text-sm text-(--dashboard-text-muted)">
          <AppCompactListItem
            v-for="item in budgetItems"
            :key="item.key"
            :active="item.active"
            clickable
            :meta="item.meta"
            :title="item.title"
            :value="item.value"
            @select="emit('selectBudgetWarning', item.warning)"
          />
          <AppCompactListItem
            v-for="item in budgetLimitItems"
            :key="item.key"
            :meta="item.meta"
            :title="item.title"
            :value="item.value"
          />
        </ul>
      </section>
    </template>
  </AnalyzeDraggableGrid>
</template>
