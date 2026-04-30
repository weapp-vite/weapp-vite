<script setup lang="ts">
import type { DashboardIconName } from '../types'
import { pillButtonStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'copySummary': []
  'copyMarkdown': []
  'copyPr': []
  'exportJson': []
  'exportMarkdown': []
  'exportCsv': []
}>()

interface ExportAction {
  key: string
  label: string
  description: string
  iconName: DashboardIconName
  action: () => void
}

const exportActions: ExportAction[] = [
  {
    key: 'summary',
    label: '复制摘要',
    description: '关键指标和首要风险，适合 IM 快速同步。',
    iconName: 'metric-copy',
    action: () => emit('copySummary'),
  },
  {
    key: 'markdown-copy',
    label: '复制完整报告',
    description: '包含预算、包体、Top 文件和重复模块表格。',
    iconName: 'file-samples',
    action: () => emit('copyMarkdown'),
  },
  {
    key: 'pr',
    label: '复制 PR 摘要',
    description: '面向评审评论的增量、预算和重复模块摘要。',
    iconName: 'metric-copy',
    action: () => emit('copyPr'),
  },
  {
    key: 'json',
    label: '导出 JSON',
    description: '保留原始 analyze payload，适合离线排查。',
    iconName: 'metric-size-outline',
    action: () => emit('exportJson'),
  },
  {
    key: 'markdown',
    label: '导出 MD',
    description: '生成完整 Markdown 报告文件。',
    iconName: 'file-samples',
    action: () => emit('exportMarkdown'),
  },
  {
    key: 'csv',
    label: '导出 CSV',
    description: '导出包、文件、重复模块和增量归因明细。',
    iconName: 'file-samples',
    action: () => emit('exportCsv'),
  },
]
</script>

<template>
  <div class="relative shrink-0" @click.stop>
    <button
      :class="pillButtonStyles({ kind: 'nav', active: open })"
      type="button"
      @click="emit('update:open', !open)"
    >
      <span class="h-4.5 w-4.5">
        <DashboardIcon name="nav-menu" />
      </span>
      更多
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-[calc(100%+0.45rem)] z-50 grid w-76 gap-1.5 rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) p-1.5 shadow-(--dashboard-shadow)"
    >
      <button
        v-for="item in exportActions"
        :key="item.key"
        class="grid grid-cols-[1.125rem_minmax(0,1fr)] gap-x-2 rounded-md px-3 py-2 text-left text-sm text-(--dashboard-text) transition hover:bg-(--dashboard-panel-muted)"
        type="button"
        @click="item.action"
      >
        <span class="mt-0.5 h-4.5 w-4.5 text-(--dashboard-text-soft)">
          <DashboardIcon :name="item.iconName" />
        </span>
        <span class="min-w-0">
          <span class="block font-medium">{{ item.label }}</span>
          <span class="mt-0.5 block text-xs leading-5 text-(--dashboard-text-soft)">
            {{ item.description }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>
