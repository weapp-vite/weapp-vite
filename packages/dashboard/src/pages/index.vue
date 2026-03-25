<script setup lang="ts">
import type { AnalyzeSubpackagesResult } from '../features/dashboard/types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DashboardHeader from '../features/dashboard/components/DashboardHeader.vue'
import DashboardMetricGrid from '../features/dashboard/components/DashboardMetricGrid.vue'
import DashboardTabs from '../features/dashboard/components/DashboardTabs.vue'
import ModulesPanel from '../features/dashboard/components/ModulesPanel.vue'
import OverviewPanel from '../features/dashboard/components/OverviewPanel.vue'
import PackagesPanel from '../features/dashboard/components/PackagesPanel.vue'
import SectionNote from '../features/dashboard/components/SectionNote.vue'
import { useAnalyzeDashboardData } from '../features/dashboard/composables/useAnalyzeDashboardData'
import { useDashboardPage } from '../features/dashboard/composables/useDashboardPage'
import { useThemeMode } from '../features/dashboard/composables/useThemeMode'
import { useTreemapData } from '../features/dashboard/composables/useTreemapData'
import { dashboardTabs, themeOptions } from '../features/dashboard/constants/view'
import 'echarts/theme/dark'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const resultRef = ref<AnalyzeSubpackagesResult | null>(window.__WEAPP_VITE_ANALYZE_RESULT__ ?? null)
const chartRef = ref<HTMLDivElement>()
const updateCount = ref(0)
const lastUpdatedAt = ref('—')
let chart: echarts.ECharts | undefined
let updateListener: (() => void) | undefined
const { themePreference, resolvedTheme, setThemePreference } = useThemeMode()

if (!resultRef.value) {
  throw new Error('[weapp-vite analyze] 未检测到分析数据，请通过 CLI 注入后再访问。')
}

const { treemapOption } = useTreemapData(resultRef, resolvedTheme)
const {
  summary,
  packageTypeSummary,
  packageInsights,
  largestFiles,
  duplicateModules,
  moduleSourceSummary,
  subPackages,
} = useAnalyzeDashboardData(resultRef)

const visibleDuplicateModules = computed(() => duplicateModules.value.slice(0, 12))
const visibleLargestFiles = computed(() => largestFiles.value.slice(0, 10))
const statusText = computed(() => `${updateCount.value} 次数据同步`)
const statusTone = computed(() => resolvedTheme.value === 'dark' ? 'icon-[mdi--circle-slice-8]' : 'icon-[mdi--checkbox-blank-circle]')
const { activeTab, topCards, packageTypeSummary: metricPackageTypeSummary } = useDashboardPage({
  summary,
  packageInsights,
  packageTypeSummary,
  duplicateModules,
  moduleSourceSummary,
  lastUpdatedAt,
})

function handleResize() {
  chart?.resize()
}

function destroyChart() {
  chart?.dispose()
  chart = undefined
}

function bindChartRef(element: Element | null) {
  chartRef.value = element instanceof HTMLDivElement
    ? element
    : undefined
}

function syncFromWindow() {
  if (window.__WEAPP_VITE_ANALYZE_RESULT__) {
    resultRef.value = window.__WEAPP_VITE_ANALYZE_RESULT__
    updateCount.value += 1
    lastUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }
}

async function ensureChart() {
  if (activeTab.value !== 'overview') {
    destroyChart()
    return
  }

  await nextTick()

  if (!chartRef.value) {
    return
  }

  if (!chart) {
    chart = echarts.init(chartRef.value, resolvedTheme.value === 'dark' ? 'dark' : undefined, { renderer: 'canvas' })
  }

  chart.setOption(treemapOption.value, true)
  chart.resize()
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

watch(activeTab, () => {
  void ensureChart()
})

watch(resolvedTheme, async () => {
  if (chart && chartRef.value) {
    destroyChart()
  }
  await ensureChart()
})

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('weapp-analyze:update', syncFromWindow)
  updateListener = syncFromWindow
  syncFromWindow()
  void ensureChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (updateListener) {
    window.removeEventListener('weapp-analyze:update', updateListener)
  }
  destroyChart()
})
</script>

<template>
  <div class="min-h-screen px-3 py-3 text-[color:var(--dashboard-text)] md:px-4 md:py-4 lg:px-5">
    <div class="mx-auto flex w-full max-w-[1500px] flex-col gap-3">
      <DashboardHeader
        :status-text="statusText"
        :last-updated-at="lastUpdatedAt"
        :subpackage-count="summary.subpackageCount"
        :theme-options="themeOptions"
        :theme-preference="themePreference"
        :resolved-theme="resolvedTheme"
        :status-tone="statusTone"
        @set-theme="setThemePreference"
      />

      <DashboardTabs :tabs="dashboardTabs" :active-tab="activeTab" @select="activeTab = $event" />

      <DashboardMetricGrid :cards="topCards" :package-type-summary="metricPackageTypeSummary" />

      <section
        v-if="activeTab === 'overview'"
      >
        <OverviewPanel
          :bind-chart-ref="bindChartRef"
          :visible-largest-files="visibleLargestFiles"
          :sub-packages="subPackages"
        />
      </section>

      <section v-else-if="activeTab === 'packages'" class="grid gap-3">
        <SectionNote text="包与产物视图优先展示每个包的结构和最大文件，支持在一个屏幕内快速对比。" />
        <PackagesPanel :package-insights="packageInsights" />
      </section>

      <section v-else class="grid gap-3">
        <SectionNote text="模块与复用视图聚焦跨包重复、来源分布与文件样本。" />
        <ModulesPanel
          :visible-duplicate-modules="visibleDuplicateModules"
          :module-source-summary="moduleSourceSummary"
          :visible-largest-files="visibleLargestFiles"
        />
      </section>
    </div>
  </div>
</template>
