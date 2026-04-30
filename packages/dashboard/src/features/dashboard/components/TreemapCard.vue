<script setup lang="ts">
import type { AnalyzeTreemapFilterMode, AnalyzeTreemapFilterOption } from '../types'
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'

const props = defineProps<{
  bindChartRef: (element: Element | null) => void
  canFocusSelected: boolean
  filterMode: AnalyzeTreemapFilterMode
  filterOptions: AnalyzeTreemapFilterOption[]
  canUseSelectedPackageFilter: boolean
  isEmpty: boolean
}>()

const emit = defineEmits<{
  focusSelected: []
  resetFocus: []
  updateFilterMode: [mode: AnalyzeTreemapFilterMode]
}>()

const chartTitle = 'Treemap'
const chartDescription = '从包体到文件再到模块，直接定位体积热点。'

function getChartBadgeClassName(): string {
  return pillButtonStyles({ kind: 'badge' })
}

function canUseFilter(option: AnalyzeTreemapFilterOption) {
  return option.value !== 'selected-package' || props.canUseSelectedPackageFilter
}
</script>

<template>
  <div :class="surfaceStyles({ padding: 'sm' })" class="flex h-full min-h-0 flex-col overflow-hidden">
    <AppPanelHeader
      class="mb-2 px-2"
      icon-name="treemap"
      :title="chartTitle"
      :description="chartDescription"
    >
      <template #meta>
        <div class="flex items-center gap-2">
          <button
            :class="[getChartBadgeClassName(), !canFocusSelected ? 'cursor-not-allowed opacity-45' : undefined]"
            :disabled="!canFocusSelected"
            type="button"
            @click="emit('focusSelected')"
          >
            聚焦选中
          </button>
          <button
            :class="getChartBadgeClassName()"
            type="button"
            @click="emit('resetFocus')"
          >
            重置
          </button>
        </div>
      </template>
    </AppPanelHeader>
    <div class="mb-2 flex flex-wrap gap-1.5 px-2">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        :class="[pillButtonStyles({ kind: 'badge', active: filterMode === option.value }), !canUseFilter(option) ? 'cursor-not-allowed opacity-45' : undefined]"
        :disabled="!canUseFilter(option)"
        type="button"
        @click="emit('updateFilterMode', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <div class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-2">
      <div
        :ref="bindChartRef"
        class="h-full min-h-0 w-full"
      />
      <AppEmptyState
        v-if="isEmpty"
        class="absolute inset-3 z-10 grid place-items-center"
        compact
      >
        当前过滤条件下没有可展示节点。
      </AppEmptyState>
    </div>
  </div>
</template>
