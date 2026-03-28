<script setup lang="ts">
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppCommandListCard from '../features/dashboard/components/AppCommandListCard.vue'
import AppInfoPill from '../features/dashboard/components/AppInfoPill.vue'
import AppRecentRuntimeEventsCard from '../features/dashboard/components/AppRecentRuntimeEventsCard.vue'
import AppRouteActionCard from '../features/dashboard/components/AppRouteActionCard.vue'
import AppRuntimeFocusCard from '../features/dashboard/components/AppRuntimeFocusCard.vue'
import AppRuntimeSourceCard from '../features/dashboard/components/AppRuntimeSourceCard.vue'
import AppStatCard from '../features/dashboard/components/AppStatCard.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import AppThemeOptionGroup from '../features/dashboard/components/AppThemeOptionGroup.vue'
import DashboardMetricGrid from '../features/dashboard/components/DashboardMetricGrid.vue'
import DashboardTabs from '../features/dashboard/components/DashboardTabs.vue'
import ModulesPanel from '../features/dashboard/components/ModulesPanel.vue'
import OverviewPanel from '../features/dashboard/components/OverviewPanel.vue'
import PackagesPanel from '../features/dashboard/components/PackagesPanel.vue'
import SectionNote from '../features/dashboard/components/SectionNote.vue'
import { useAnalyzeDashboardData } from '../features/dashboard/composables/useAnalyzeDashboardData'
import { useDashboardPage } from '../features/dashboard/composables/useDashboardPage'
import { useDashboardTheme } from '../features/dashboard/composables/useDashboardTheme'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { useTreemapData } from '../features/dashboard/composables/useTreemapData'
import { dashboardTabs, themeOptions } from '../features/dashboard/constants/view'
import { formatDuration } from '../features/dashboard/utils/format'
import { summarizeRuntimeEventsBySource } from '../features/dashboard/utils/runtimeEvents'
import 'echarts/theme/dark'

echarts.use([
  TreemapChart,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const chartRef = shallowRef<HTMLDivElement>()
let chart: echarts.ECharts | undefined
const { themePreference, resolvedTheme, setThemePreference } = useDashboardTheme()
const { eventSummary, lastUpdatedAt, latestRuntimeEvent, resultRef, runtimeEvents, updateCount } = useDashboardWorkspace()

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
const recentRuntimeEvents = computed(() => runtimeEvents.value.slice(0, 3))
const runtimeSourceSummary = computed(() =>
  summarizeRuntimeEventsBySource(runtimeEvents.value)
    .map(source => ({
      ...source,
      averageDuration: formatDuration(source.averageDurationMs),
    }))
    .slice(0, 4),
)
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
  void ensureChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
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
        <AppCommandListCard
          eyebrow="recommended commands"
          :commands="[
            'weapp-vite analyze',
            'weapp-vite build --ui',
            'weapp-vite dev --ui',
          ]"
        />

        <div class="grid gap-2">
          <AppRouteActionCard
            to="/"
            title="返回工作台"
            description="继续查看应用壳子、命令面板和当前增强节奏。"
          />
          <AppRouteActionCard
            to="/activity"
            title="查看活动流"
            description="后续可以在这里观察真实的构建事件和诊断状态。"
          />
        </div>
      </div>
    </AppSurfaceCard>

    <section class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <DashboardTabs :tabs="dashboardTabs" :active-tab="activeTab" @select="activeTab = $event" />
      <div class="flex flex-wrap items-center gap-2">
        <AppThemeOptionGroup
          :options="themeOptions"
          :selected-value="themePreference"
          @select="setThemePreference"
        />
        <AppInfoPill :icon-name="statusTone" :label="statusText" uppercase />
        <AppInfoPill :label="lastUpdatedAt" uppercase />
      </div>
    </section>

    <template v-if="resultRef">
      <section class="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <AppSurfaceCard
          eyebrow="Runtime Context"
          title="分析视图关联的运行上下文"
          description="treemap 和包体指标不再是孤立结果，这里会同步展示最近的运行事件，让你知道这份分析结果处在什么执行背景里。"
          icon-name="metric-time"
        >
          <div class="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <AppRuntimeFocusCard
              :event="latestRuntimeEvent"
              eyebrow="latest event"
              :duration-text="latestRuntimeEvent?.durationMs !== undefined ? `最近一次耗时: ${formatDuration(latestRuntimeEvent.durationMs)}` : undefined"
            >
              <RouterLink
                class="mt-4 inline-flex rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-3 py-1.5 text-xs font-medium text-[color:var(--dashboard-text)] transition hover:border-[color:var(--dashboard-border-strong)]"
                to="/activity"
              >
                打开事件控制台
              </RouterLink>
            </AppRuntimeFocusCard>

            <div class="grid gap-2 sm:grid-cols-2">
              <AppStatCard
                v-for="item in eventSummary"
                :key="item.label"
                :label="item.label"
                :value="item.value"
              />
            </div>
          </div>
        </AppSurfaceCard>

        <AppSurfaceCard
          eyebrow="Source Signals"
          title="事件来源摘要"
          description="分析页直接按来源折叠运行事件，方便判断当前这份 payload 主要来自哪条链路。"
          icon-name="hero-system"
        >
          <div class="grid gap-2 sm:grid-cols-2">
            <AppRuntimeSourceCard
              v-for="source in runtimeSourceSummary"
              :key="source.source"
              :source="source.source"
              :count="source.count"
              :error-count="source.errorCount"
              :average-duration="source.averageDuration"
              count-label="条事件"
            />
          </div>
        </AppSurfaceCard>

        <AppRecentRuntimeEventsCard :events="recentRuntimeEvents" />
      </section>

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
