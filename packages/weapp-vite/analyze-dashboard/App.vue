<script setup lang="ts">
import type { AnalyzeSubpackagesResult } from './src-types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DASHBOARD_THEME, ensureDashboardTheme } from './chart-theme'
import { formatBytes, useTreemapData } from './useTreemapData'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

ensureDashboardTheme()

const resultRef = ref<AnalyzeSubpackagesResult | null>(window.__WEAPP_VITE_ANALYZE_RESULT__ ?? null)
const chartRef = ref<HTMLDivElement>()
let chart: echarts.ECharts | undefined
let updateListener: (() => void) | undefined

if (!resultRef.value) {
  throw new Error('[weapp-vite analyze] 未检测到分析数据，请通过 CLI 注入后再访问。')
}

const { summary, duplicateModules, treemapOption } = useTreemapData(resultRef)

function handleResize() {
  chart?.resize()
}

watch(
  treemapOption,
  (newOption) => {
    if (chart) {
      chart.setOption(newOption, true)
    }
  },
  { deep: true },
)

onMounted(() => {
  if (!chartRef.value) {
    return
  }

  chart = echarts.init(chartRef.value, DASHBOARD_THEME, { renderer: 'canvas' })
  chart.setOption(treemapOption.value)
  window.addEventListener('resize', handleResize)

  const syncFromWindow = () => {
    if (window.__WEAPP_VITE_ANALYZE_RESULT__) {
      resultRef.value = window.__WEAPP_VITE_ANALYZE_RESULT__
    }
  }
  window.addEventListener('weapp-analyze:update', syncFromWindow)
  updateListener = syncFromWindow
  syncFromWindow()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (updateListener) {
    window.removeEventListener('weapp-analyze:update', updateListener)
  }
  chart?.dispose()
  chart = undefined
})
</script>

<template>
  <div
    class="flex min-h-screen flex-col gap-6 bg-slate-950/95 px-6 py-8 text-slate-100 md:px-12 lg:px-16"
  >
    <header
      class="flex flex-col gap-6 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-6 shadow-inner lg:flex-row lg:items-start lg:justify-between"
    >
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight md:text-4xl">
          weapp-vite Analyze
        </h1>
        <p class="max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
          当前构建的主包、分包与源码模块映射情况。使用 Treemap 快速识别包体结构及跨包复用。
        </p>
      </div>
      <ul
        class="grid w-full max-w-xl grid-cols-2 gap-3 text-left text-sm md:grid-cols-4 md:text-base"
      >
        <li class="rounded-xl border border-slate-700/40 bg-slate-900/70 p-4">
          <span class="block text-xs uppercase tracking-wider text-slate-400">包体数量</span>
          <span class="mt-2 block text-2xl font-semibold text-slate-100">
            {{ summary.packageCount }}
          </span>
        </li>
        <li class="rounded-xl border border-slate-700/40 bg-slate-900/70 p-4">
          <span class="block text-xs uppercase tracking-wider text-slate-400">源码模块</span>
          <span class="mt-2 block text-2xl font-semibold text-slate-100">
            {{ summary.moduleCount }}
          </span>
        </li>
        <li class="rounded-xl border border-slate-700/40 bg-slate-900/70 p-4">
          <span class="block text-xs uppercase tracking-wider text-slate-400">跨包复用</span>
          <span class="mt-2 block text-2xl font-semibold text-slate-100">
            {{ summary.duplicateCount }}
          </span>
        </li>
        <li class="rounded-xl border border-slate-700/40 bg-slate-900/70 p-4">
          <span class="block text-xs uppercase tracking-wider text-slate-400">总产物</span>
          <span class="mt-2 block text-2xl font-semibold text-slate-100">
            {{ formatBytes(summary.totalBytes) }}
          </span>
        </li>
      </ul>
    </header>

    <main
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]"
    >
      <div
        ref="chartRef"
        class="min-h-[26rem] rounded-2xl border border-slate-700/40 bg-slate-900/70 p-2"
      />
      <aside
        v-if="duplicateModules.length"
        class="flex flex-col gap-4 rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5"
      >
        <h2 class="text-lg font-medium text-slate-100">
          跨包复用模块 TOP {{ duplicateModules.length }}
        </h2>
        <ol class="space-y-3 text-sm text-slate-300">
          <li v-for="duplicate in duplicateModules" :key="duplicate.source" class="space-y-1">
            <p class="break-all font-medium text-slate-100">
              {{ duplicate.source }}
            </p>
            <p class="text-xs text-slate-400">
              出现 {{ duplicate.count }} 次 ·
              <span class="text-slate-200">{{ duplicate.packages.join('、') }}</span>
            </p>
          </li>
        </ol>
      </aside>
    </main>
  </div>
</template>
