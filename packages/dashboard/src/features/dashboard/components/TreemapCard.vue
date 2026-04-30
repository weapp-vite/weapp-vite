<script setup lang="ts">
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  bindChartRef: (element: Element | null) => void
}>()

const chartTitle = 'Treemap'
const chartDescription = '从包体到文件再到模块，直接定位体积热点。'
const chartBadgeLabel = 'overview'

function getChartBadgeClassName(): string {
  return pillButtonStyles({ kind: 'badge' })
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
        <span :class="getChartBadgeClassName()">
          {{ chartBadgeLabel }}
        </span>
      </template>
    </AppPanelHeader>
    <div
      :ref="bindChartRef"
      class="min-h-0 flex-1 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-2"
    />
  </div>
</template>
