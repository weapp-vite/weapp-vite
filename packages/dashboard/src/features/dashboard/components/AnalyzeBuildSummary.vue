<script setup lang="ts">
import type { AnalyzeActionCenterItem, DashboardMetricCard, LargestFileEntry, PackageInsight, SummaryMetric } from '../types'
import { shallowRef } from 'vue'
import { useAnalyzeBuildSummary } from '../composables/useAnalyzeBuildSummary'
import { formatBytes, formatPackageType } from '../utils/format'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  actionItems: AnalyzeActionCenterItem[]
  cards: DashboardMetricCard[]
  largestFiles: LargestFileEntry[]
  packageInsights: PackageInsight[]
  packageTypeSummary: SummaryMetric[]
}>()

const emit = defineEmits<{
  copyReport: []
  selectFile: [file: LargestFileEntry]
  selectPackage: [item: PackageInsight]
}>()

const {
  budgetSummary,
  copyReleaseGateReport,
  gateCopyStatus,
  packageOverviewItems,
  packagePreviewItems,
  releaseGate,
  totalPackageBytesLabel,
} = useAnalyzeBuildSummary(props)

const detailsOpen = shallowRef(false)

function handleDetailsToggle(event: Event) {
  detailsOpen.value = (event.target as HTMLDetailsElement).open
}
</script>

<template>
  <section class="grid min-w-0 content-start gap-2">
    <header class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
      <h2 class="text-xs font-medium text-(--dashboard-text-soft)">总产物体积</h2>
      <p class="text-xl font-semibold leading-7 tabular-nums text-(--dashboard-text)">
        {{ totalPackageBytesLabel }}
      </p>
      <p class="w-full text-xs leading-4 text-(--dashboard-text-muted)">{{ budgetSummary }}</p>
    </header>

    <figure class="min-w-0">
      <figcaption class="text-xs leading-4 text-(--dashboard-text-soft)">
        包体占比 · 前 {{ packagePreviewItems.length }} 包 · 满格 = 总量
      </figcaption>
      <p v-if="packagePreviewItems.length === 0" class="mt-2 text-sm text-(--dashboard-text-soft)">
        当前没有包体数据。
      </p>
      <ol v-else class="mt-1 grid min-w-0">
        <li v-for="item in packagePreviewItems" :key="item.id" class="min-w-0">
          <button
            type="button"
            class="block min-h-8 w-full min-w-0 rounded-sm py-1 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
            :aria-label="`查看包 ${item.label} 的详情，${item.sizeLabel}`"
            @click="emit('selectPackage', item)"
          >
            <span class="flex min-w-0 items-baseline justify-between gap-2 text-xs leading-4">
              <span :title="item.label" class="min-w-0 truncate font-medium text-(--dashboard-text)">{{ item.label }}</span>
              <span class="shrink-0 tabular-nums text-(--dashboard-text-muted)">{{ item.sizeLabel }}</span>
            </span>
            <span class="mt-1 block h-1 overflow-hidden rounded-full bg-(--dashboard-panel-muted)" aria-hidden="true">
              <span class="block h-full rounded-full bg-(--dashboard-accent)" :style="item.shareStyle" />
            </span>
          </button>
        </li>
      </ol>
    </figure>

    <details class="group min-w-0 border-t border-(--dashboard-border)" @toggle="handleDetailsToggle">
      <summary class="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-sm py-1.5 text-xs font-medium text-(--dashboard-text-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11">
        <span class="min-w-0">全部 {{ packageInsights.length }} 包与构建明细</span>
        <span class="icon-[mdi--chevron-down] size-4 shrink-0 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div v-if="detailsOpen" class="grid min-w-0 gap-5 pt-2 pb-4">
        <section class="min-w-0">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">评分与分析依据</h3>
          <p class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">{{ releaseGate.description }}</p>
          <dl class="mt-2 grid gap-2 text-sm">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-(--dashboard-text-soft)">分析评分</dt>
              <dd class="font-semibold tabular-nums text-(--dashboard-text)">{{ releaseGate.score }} / 100</dd>
            </div>
            <div v-for="metric in releaseGate.metrics" :key="metric.label" class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-(--dashboard-text-soft)">{{ metric.label }}</dt>
              <dd class="font-semibold tabular-nums text-(--dashboard-text)">{{ metric.value }}</dd>
            </div>
          </dl>
          <p class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">仅基于当前分析，不代表发布审批。</p>
          <ul v-if="releaseGate.recommendations.length > 0" class="mt-2 grid gap-2 text-sm leading-6 text-(--dashboard-text-muted)">
            <li v-for="recommendation in releaseGate.recommendations" :key="recommendation">{{ recommendation }}</li>
          </ul>
        </section>

        <section class="min-w-0">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">全部指标</h3>
          <dl class="mt-2 grid gap-3 text-sm">
            <div v-for="card in cards" :key="card.label" class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt class="text-(--dashboard-text-soft)">{{ card.label }}</dt>
              <dd class="font-semibold tabular-nums text-(--dashboard-text)">{{ card.value }}</dd>
              <dd v-if="card.detail" class="w-full text-xs leading-5 text-(--dashboard-text-muted)">{{ card.detail }}</dd>
            </div>
          </dl>
          <p v-if="packageTypeSummary.length > 0" class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-(--dashboard-text-soft)">
            <span v-for="item in packageTypeSummary" :key="item.label">{{ formatPackageType(item.label) }} {{ item.value }}</span>
          </p>
        </section>

        <section class="min-w-0">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">全部包体</h3>
          <p v-if="packageOverviewItems.length === 0" class="mt-2 text-sm leading-6 text-(--dashboard-text-soft)">当前没有包体数据。</p>
          <ol v-else class="mt-2 divide-y divide-(--dashboard-border)">
            <li v-for="item in packageOverviewItems" :key="item.id" class="min-w-0">
              <button
                type="button"
                class="w-full min-w-0 rounded-sm py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
                :aria-label="`查看包 ${item.label} 的详情`"
                @click="emit('selectPackage', item)"
              >
                <span class="block text-sm font-semibold leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ item.label }}</span>
                <span class="block text-xs leading-5 text-(--dashboard-text-soft)">
                  {{ item.typeLabel }} · {{ item.fileCount }} 产物 · {{ item.moduleCount }} 模块
                </span>
                <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-6 tabular-nums">
                  <span class="font-semibold text-(--dashboard-text)">{{ item.sizeLabel }}</span>
                  <span class="text-(--dashboard-text-soft)">{{ item.compressedLabel }}</span>
                </span>
                <span class="block text-xs leading-5 tabular-nums text-(--dashboard-text-soft)">{{ item.deltaLabel || '无可比基线' }}</span>
                <span class="mt-1 block text-xs leading-5 text-(--dashboard-accent)">查看包详情 →</span>
              </button>
            </li>
          </ol>
        </section>

        <section class="min-w-0">
          <h3 class="text-sm font-semibold text-(--dashboard-text)">文件体积排行</h3>
          <p v-if="largestFiles.length === 0" class="mt-2 text-sm leading-6 text-(--dashboard-text-soft)">当前没有文件体积数据。</p>
          <ol v-else class="mt-2 divide-y divide-(--dashboard-border)">
            <li v-for="file in largestFiles" :key="`${file.packageId}:${file.file}`" class="min-w-0">
              <button
                type="button"
                class="w-full min-w-0 rounded-sm py-3 text-left hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
                :aria-label="`查看文件 ${file.file} 的详情`"
                @click="emit('selectFile', file)"
              >
                <span class="block font-mono text-sm font-medium leading-6 text-(--dashboard-text) [overflow-wrap:anywhere]">{{ file.file }}</span>
                <span class="mt-1 block text-xs leading-5 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
                  {{ file.packageLabel }} · {{ file.type }} · {{ file.moduleCount }} 模块
                </span>
                <span class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm leading-6 tabular-nums">
                  <span class="font-semibold text-(--dashboard-text)">{{ formatBytes(file.size) }}</span>
                  <span class="text-(--dashboard-text-soft)">{{ file.compressedSizeSource === 'real' ? 'Brotli' : '估算压缩' }} {{ formatBytes(file.compressedSize) }}</span>
                </span>
                <span class="mt-1 block text-xs leading-5 text-(--dashboard-accent)">查看文件详情 →</span>
              </button>
            </li>
          </ol>
        </section>

        <div class="grid min-w-0 gap-2 border-t border-(--dashboard-border) pt-3">
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-(--dashboard-border) px-2 py-2 text-sm text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
            @click="copyReleaseGateReport"
          >
            <span class="size-4 shrink-0" aria-hidden="true"><DashboardIcon name="metric-copy" /></span>
            复制构建结论
          </button>
          <span role="status" class="text-xs leading-5 text-(--dashboard-accent)">{{ gateCopyStatus }}</span>
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-(--dashboard-border) px-2 py-2 text-sm text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
            @click="emit('copyReport')"
          >
            <span class="size-4 shrink-0" aria-hidden="true"><DashboardIcon name="metric-copy" /></span>
            复制评审摘要
          </button>
        </div>
      </div>
    </details>
  </section>
</template>
