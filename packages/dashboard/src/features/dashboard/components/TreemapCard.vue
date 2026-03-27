<script setup lang="ts">
import { pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  bindChartRef: (element: Element | null) => void
}>()
</script>

<template>
  <div :class="surfaceStyles({ padding: 'sm' })">
    <AppPanelHeader
      class="mb-2 px-2"
      icon-name="treemap"
      title="Treemap"
      description="从包体到文件再到模块，直接定位体积热点。"
    >
      <template #meta>
        <span :class="pillButtonStyles({ kind: 'badge' })">
          overview
        </span>
      </template>
    </AppPanelHeader>
    <div
      :ref="bindChartRef"
      class="h-[min(58vh,36rem)] min-h-[21rem] rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-2"
    />
  </div>
</template>
