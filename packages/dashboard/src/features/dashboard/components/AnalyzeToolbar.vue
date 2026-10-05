<script setup lang="ts">
import type { DashboardInfoPillItem } from '../types'
import AnalyzeExportMenu from './AnalyzeExportMenu.vue'
import AppInfoPill from './AppInfoPill.vue'
import AppToolButton from './AppToolButton.vue'

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
  <section class="relative z-20 flex min-w-0 flex-wrap items-center gap-2 overflow-visible rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 shadow-(--dashboard-shadow)">
    <div class="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
      <AppToolButton
        v-if="canSearch"
        icon-name="metric-search"
        label="搜索分析结果"
        touch-label="搜索"
        @click="emit('openSearch')"
      />
      <AppToolButton
        v-if="canSearch"
        icon-name="metric-link"
        label="复制视图链接"
        touch-label="复制"
        @click="emit('copyViewLink')"
      />
      <div v-if="canSearch" class="hidden sm:block">
        <AppToolButton
          icon-name="metric-reset"
          label="重置视图"
          touch-label="重置"
          :disabled="!canResetView"
          @click="emit('resetView')"
        />
      </div>
    </div>
    <div class="order-last flex min-w-0 w-full flex-wrap items-center gap-2 empty:hidden sm:order-none sm:w-auto sm:flex-1">
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
      :can-reset-view="canResetView"
      @reset-view="emit('resetView')"
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
