<script setup lang="ts">
import type { DashboardInfoPillItem } from '../types'
import { pillButtonStyles } from '../utils/styles'
import AnalyzeExportMenu from './AnalyzeExportMenu.vue'
import AppInfoPill from './AppInfoPill.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  canSearch: boolean
  canResetView: boolean
  exportStatus: string
  moreMenuOpen: boolean
  openWorkQueueCount: number
  statusPills: DashboardInfoPillItem[]
}>()

const emit = defineEmits<{
  'copyMarkdown': []
  'copyPr': []
  'copySummary': []
  'copyViewLink': []
  'exportCsv': []
  'exportJson': []
  'exportMarkdown': []
  'openSearch': []
  'resetView': []
  'update:moreMenuOpen': [value: boolean]
}>()
</script>

<template>
  <section class="relative z-20 flex min-w-0 items-center gap-2 overflow-visible rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 shadow-(--dashboard-shadow)">
    <div class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
      <button
        v-if="canSearch"
        class="shrink-0"
        :class="pillButtonStyles({ kind: 'nav', active: false })"
        @click="emit('openSearch')"
      >
        <span class="h-4.5 w-4.5">
          <DashboardIcon name="metric-search" />
        </span>
        搜索
      </button>
      <button
        v-if="canSearch"
        class="shrink-0"
        :class="pillButtonStyles({ kind: 'nav', active: false })"
        @click="emit('copyViewLink')"
      >
        <span class="h-4.5 w-4.5">
          <DashboardIcon name="metric-link" />
        </span>
        复制视图
      </button>
      <button
        v-if="canSearch"
        class="shrink-0 disabled:cursor-not-allowed disabled:opacity-55"
        :class="pillButtonStyles({ kind: 'nav', active: false })"
        :disabled="!canResetView"
        @click="emit('resetView')"
      >
        <span class="h-4.5 w-4.5">
          <DashboardIcon name="metric-reset" />
        </span>
        重置视图
      </button>
      <AppInfoPill
        v-if="exportStatus"
        class="shrink-0"
        :label="exportStatus"
        uppercase
      />
      <AppInfoPill
        v-if="openWorkQueueCount > 0"
        class="shrink-0"
        icon-name="metric-bookmark"
        :label="`${openWorkQueueCount} 个待处理`"
        uppercase
      />
      <AppInfoPill
        v-for="item in statusPills"
        :key="item.label"
        class="shrink-0"
        v-bind="item"
        uppercase
      />
    </div>
    <AnalyzeExportMenu
      v-if="canSearch"
      :open="moreMenuOpen"
      @update:open="emit('update:moreMenuOpen', $event)"
      @copy-markdown="emit('copyMarkdown')"
      @copy-pr="emit('copyPr')"
      @copy-summary="emit('copySummary')"
      @export-csv="emit('exportCsv')"
      @export-json="emit('exportJson')"
      @export-markdown="emit('exportMarkdown')"
    />
  </section>
</template>
