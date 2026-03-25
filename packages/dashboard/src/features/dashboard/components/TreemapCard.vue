<script setup lang="ts">
import { iconFrameStyles, pillButtonStyles, surfaceStyles } from '../utils/styles'

defineProps<{
  bindChartRef: (element: Element | null) => void
}>()
</script>

<template>
  <div :class="surfaceStyles({ padding: 'sm' })">
    <div class="mb-2 flex items-center justify-between gap-4 px-2">
      <div class="flex items-center gap-2">
        <span :class="iconFrameStyles()">
          <span class="icon-[mdi--chart-treemap] h-5 w-5" />
        </span>
        <div>
          <h2 class="text-lg font-semibold">
            Treemap
          </h2>
          <p class="text-xs text-[color:var(--dashboard-text-soft)] md:text-sm">
            从包体到文件再到模块，直接定位体积热点。
          </p>
        </div>
      </div>
      <span :class="pillButtonStyles({ kind: 'badge' })">
        overview
      </span>
    </div>
    <div
      :ref="bindChartRef"
      class="h-[min(58vh,36rem)] min-h-[21rem] rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-2"
    />
  </div>
</template>
