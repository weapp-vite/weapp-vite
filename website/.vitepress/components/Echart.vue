<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useData } from 'vitepress'
import { computed } from 'vue'
import VChart from 'vue-echarts'

const { option } = defineProps<{
  option: EChartsOption
}>()
const { isDark } = useData()
use([
  CanvasRenderer,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  BarChart,
  LineChart,
  ToolboxComponent,
  GridComponent,
])

// provide(THEME_KEY, isDark.value ? 'dark' : 'light')

const theme = computed(() => {
  return isDark.value ? 'dark' : 'light'
})
</script>

<template>
  <VChart class="chart" :option="option" autoresize :theme="theme" />
</template>

<style lang="scss" scoped></style>
