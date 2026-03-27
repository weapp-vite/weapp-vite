<script setup lang="ts">
import type { AnalyzeSubpackagesResult } from '../features/dashboard/types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardMetricGrid from '../features/dashboard/components/DashboardMetricGrid.vue'
import DashboardTabs from '../features/dashboard/components/DashboardTabs.vue'
import ModulesPanel from '../features/dashboard/components/ModulesPanel.vue'
import OverviewPanel from '../features/dashboard/components/OverviewPanel.vue'
import PackagesPanel from '../features/dashboard/components/PackagesPanel.vue'
import SectionNote from '../features/dashboard/components/SectionNote.vue'
import { useAnalyzeDashboardData } from '../features/dashboard/composables/useAnalyzeDashboardData'
import { useDashboardPage } from '../features/dashboard/composables/useDashboardPage'
import { useDashboardTheme } from '../features/dashboard/composables/useDashboardTheme'
import { useTreemapData } from '../features/dashboard/composables/useTreemapData'
import { dashboardTabs } from '../features/dashboard/constants/view'
import { pillButtonStyles } from '../features/dashboard/utils/styles'
import 'echarts/theme/dark'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const resultRef = shallowRef<AnalyzeSubpackagesResult | null>(window.__WEAPP_VITE_ANALYZE_RESULT__ ?? null)
const chartRef = shallowRef<HTMLDivElement>()
const updateCount = shallowRef(0)
const lastUpdatedAt = shallowRef('—')
let chart: echarts.ECharts | undefined
let updateListener: (() => void) | undefined
const { themePreference, resolvedTheme, setThemePreference } = useDashboardTheme()

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
const statusTone = computed(() => resolvedTheme.value === 'dark' ? 'status-dark' : 'status-light')
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
  <div class="grid gap-3">
    <AppSurfaceCard
      v-if="!resultRef"
      eyebrow="Analyze"
      title="等待分析数据注入"
      description="当前路由已经可独立打开，但还没有接收到来自 CLI 的 analyze payload。你可以先从工作台查看壳子结构，或者通过命令启动真实数据联调。"
      icon-name="hero-commands"
      tone="strong"
      padding="header"
    >
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.92fr)]">
        <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
          <p class="text-[11px] uppercase tracking-[0.24em] text-[color:var(--dashboard-text-soft)]">
            recommended commands
          </p>
          <div class="mt-4 grid gap-2">
            <code class="rounded-xl bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900">
              weapp-vite analyze
            </code>
            <code class="rounded-xl bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900">
              weapp-vite build --ui
            </code>
            <code class="rounded-xl bg-slate-950 px-3 py-3 text-xs text-slate-100 dark:bg-slate-900">
              weapp-vite dev --ui
            </code>
          </div>
        </div>

        <div class="grid gap-2">
          <RouterLink
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-4 transition hover:border-[color:var(--dashboard-border-strong)] hover:bg-[color:var(--dashboard-panel)]"
            to="/"
          >
            <p class="font-medium">
              返回工作台
            </p>
            <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
              继续查看应用壳子、命令面板和当前增强节奏。
            </p>
          </RouterLink>
          <RouterLink
            class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-4 transition hover:border-[color:var(--dashboard-border-strong)] hover:bg-[color:var(--dashboard-panel)]"
            to="/activity"
          >
            <p class="font-medium">
              查看活动流
            </p>
            <p class="mt-1 text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
              后续可以在这里观察真实的构建事件和诊断状态。
            </p>
          </RouterLink>
        </div>
      </div>
    </AppSurfaceCard>

    <section class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <DashboardTabs :tabs="dashboardTabs" :active-tab="activeTab" @select="activeTab = $event" />
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="option in [
            { value: 'system', label: '跟随系统', iconClass: 'icon-[mdi--theme-light-dark]' },
            { value: 'light', label: '亮色', iconClass: 'icon-[mdi--white-balance-sunny]' },
            { value: 'dark', label: '暗色', iconClass: 'icon-[mdi--moon-waning-crescent]' },
          ]"
          :key="option.value"
          :class="pillButtonStyles({ kind: 'theme', active: themePreference === option.value })"
          @click="setThemePreference(option.value)"
        >
          <span class="h-4 w-4" :class="option.iconClass" />
          {{ option.label }}
        </button>
        <span class="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
          <span class="h-4 w-4 text-[color:var(--dashboard-accent)]" :class="statusTone" />
          {{ statusText }}
        </span>
        <span class="inline-flex items-center rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
          {{ lastUpdatedAt }}
        </span>
      </div>
    </section>

    <template v-if="resultRef">
      <DashboardMetricGrid :cards="topCards" :package-type-summary="metricPackageTypeSummary" />

      <section v-if="activeTab === 'overview'">
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
    </template>
  </div>
</template>
