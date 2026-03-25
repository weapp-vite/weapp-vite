<script setup lang="ts">
import type { AnalyzeSubpackagesResult } from '../types'
import { TreemapChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ModulesPanel from '../components/ModulesPanel.vue'
import PackagesPanel from '../components/PackagesPanel.vue'
import { formatBytes, formatPackageType } from '../format'
import { useAnalyzeDashboardData } from '../useAnalyzeDashboardData'
import { useTreemapData } from '../useTreemapData'
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
const activeTab = ref<'overview' | 'packages' | 'modules'>('overview')
const updateCount = ref(0)
const lastUpdatedAt = ref('—')
let chart: echarts.ECharts | undefined
let updateListener: (() => void) | undefined

if (!resultRef.value) {
  throw new Error('[weapp-vite analyze] 未检测到分析数据，请通过 CLI 注入后再访问。')
}

const { treemapOption } = useTreemapData(resultRef)
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

  chart = echarts.init(chartRef.value, 'dark', { renderer: 'canvas' })
  chart.setOption(treemapOption.value)
  window.addEventListener('resize', handleResize)

  const syncFromWindow = () => {
    if (window.__WEAPP_VITE_ANALYZE_RESULT__) {
      resultRef.value = window.__WEAPP_VITE_ANALYZE_RESULT__
      updateCount.value += 1
      lastUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
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
  <div class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.28),_transparent_36%),linear-gradient(180deg,_#020617_0%,_#0f172a_48%,_#020617_100%)] px-4 py-6 text-slate-100 md:px-8 lg:px-10">
    <div class="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
      <header class="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-slate-950/70 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur">
        <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div class="max-w-3xl space-y-3">
            <p class="text-xs uppercase tracking-[0.32em] text-cyan-300/80">
              weapp-vite UI
            </p>
            <h1 class="text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Analyze Workspace
            </h1>
            <p class="text-sm leading-7 text-slate-300 md:text-base">
              统一查看主包、分包、chunk、asset 与跨包模块映射。当前页面是 `--ui` 的分析视图，后续可继续挂接更多调试面板。
            </p>
          </div>
          <div class="grid gap-3 text-sm text-slate-300 sm:grid-cols-3 xl:min-w-[32rem]">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">
                同步状态
              </p>
              <p class="mt-3 text-lg font-semibold text-white">
                {{ statusText }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">
                最近刷新
              </p>
              <p class="mt-3 text-lg font-semibold text-white">
                {{ lastUpdatedAt }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">
                分包配置
              </p>
              <p class="mt-3 text-lg font-semibold text-white">
                {{ summary.subpackageCount }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <nav class="flex flex-wrap gap-3">
        <button
          class="rounded-full border px-4 py-2 text-sm transition"
          :class="activeTab === 'overview' ? 'border-cyan-300 bg-cyan-300/15 text-white' : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/40 hover:text-white'"
          @click="activeTab = 'overview'"
        >
          总览
        </button>
        <button
          class="rounded-full border px-4 py-2 text-sm transition"
          :class="activeTab === 'packages' ? 'border-cyan-300 bg-cyan-300/15 text-white' : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/40 hover:text-white'"
          @click="activeTab = 'packages'"
        >
          包与产物
        </button>
        <button
          class="rounded-full border px-4 py-2 text-sm transition"
          :class="activeTab === 'modules' ? 'border-cyan-300 bg-cyan-300/15 text-white' : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/40 hover:text-white'"
          @click="activeTab = 'modules'"
        >
          模块与复用
        </button>
      </nav>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-1">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-400">
            包体数量
          </p>
          <p class="mt-3 text-3xl font-semibold text-white">
            {{ summary.packageCount }}
          </p>
        </article>
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-1">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-400">
            源码模块
          </p>
          <p class="mt-3 text-3xl font-semibold text-white">
            {{ summary.moduleCount }}
          </p>
        </article>
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-1">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-400">
            跨包复用
          </p>
          <p class="mt-3 text-3xl font-semibold text-white">
            {{ summary.duplicateCount }}
          </p>
        </article>
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-1">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-400">
            Entry 数量
          </p>
          <p class="mt-3 text-3xl font-semibold text-white">
            {{ summary.entryCount }}
          </p>
        </article>
        <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5 xl:col-span-2">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-400">
            总产物体积
          </p>
          <p class="mt-3 text-3xl font-semibold text-white">
            {{ formatBytes(summary.totalBytes) }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="item in packageTypeSummary"
              :key="item.label"
              class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
            >
              {{ formatPackageType(item.label) }} {{ item.value }}
            </span>
          </div>
        </article>
      </section>

      <section v-if="activeTab === 'overview'" class="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.85fr)]">
        <div class="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div class="mb-4 flex items-center justify-between gap-4 px-2">
            <div>
              <h2 class="text-xl font-semibold text-white">
                Treemap
              </h2>
              <p class="text-sm text-slate-400">
                从包体到文件再到模块，直接定位体积热点。
              </p>
            </div>
          </div>
          <div ref="chartRef" class="min-h-[34rem] rounded-[20px] bg-slate-950/70 p-2" />
        </div>

        <div class="flex flex-col gap-6">
          <section class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 class="text-xl font-semibold text-white">
              Top Files
            </h2>
            <ol class="mt-4 space-y-3 text-sm">
              <li
                v-for="file in visibleLargestFiles"
                :key="`${file.packageId}:${file.file}`"
                class="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-medium text-white">
                      {{ file.file }}
                    </p>
                    <p class="mt-1 text-xs text-slate-400">
                      {{ file.packageLabel }} · {{ formatPackageType(file.packageType) }} · {{ file.type }}
                    </p>
                  </div>
                  <span class="whitespace-nowrap text-cyan-200">{{ formatBytes(file.size) }}</span>
                </div>
              </li>
            </ol>
          </section>

          <section class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 class="text-xl font-semibold text-white">
              Subpackages
            </h2>
            <ul class="mt-4 space-y-3 text-sm text-slate-300">
              <li
                v-for="pkg in subPackages"
                :key="pkg.root"
                class="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
              >
                <p class="font-medium text-white">
                  {{ pkg.root }}
                </p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ pkg.name ? `别名 ${pkg.name}` : '未设置别名' }} · {{ pkg.independent ? '独立分包' : '普通分包' }}
                </p>
              </li>
            </ul>
          </section>
        </div>
      </section>

      <PackagesPanel v-else-if="activeTab === 'packages'" :package-insights="packageInsights" />
      <ModulesPanel
        v-else
        :visible-duplicate-modules="visibleDuplicateModules"
        :module-source-summary="moduleSourceSummary"
        :visible-largest-files="visibleLargestFiles"
      />
    </div>
  </div>
</template>
