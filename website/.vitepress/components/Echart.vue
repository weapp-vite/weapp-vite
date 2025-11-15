<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { useData } from 'vitepress'
import { computed, defineAsyncComponent } from 'vue'

const { option } = defineProps<{ option: EChartsOption }>()

const { isDark } = useData()
const theme = computed(() => (isDark.value ? 'dark' : 'light'))

// Lazy-load echarts and vue-echarts on client to reduce initial bundle size
const VChart = defineAsyncComponent(async () => {
  if (typeof window !== 'undefined') {
    const [{ use }, renderers, charts, comps] = await Promise.all([
      import('echarts/core'),
      import('echarts/renderers'),
      import('echarts/charts'),
      import('echarts/components'),
    ])
    const { CanvasRenderer } = renderers
    const { PieChart, LineChart, BarChart } = charts
    const {
      TitleComponent,
      TooltipComponent,
      LegendComponent,
      ToolboxComponent,
      GridComponent,
    } = comps
    use([
      CanvasRenderer,
      PieChart,
      LineChart,
      BarChart,
      TitleComponent,
      TooltipComponent,
      LegendComponent,
      ToolboxComponent,
      GridComponent,
    ])
  }
  const mod = await import('vue-echarts')
  return mod.default
})
</script>

<template>
  <Suspense>
    <VChart class="chart" :option="option" autoresize :theme="theme" />
  </Suspense>
</template>

<style scoped>
.chart {
  width: 100%;
  min-height: 240px;
}
</style>
