<script setup lang="ts">
import type { DashboardMetricItem, PackageBudgetWarning, PackageInsight, TreemapNodeMeta } from '../types'
import { computed } from 'vue'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppMetricTile from './AppMetricTile.vue'
import AppPackageFileTable from './AppPackageFileTable.vue'
import AppPanelHeader from './AppPanelHeader.vue'

interface PackageInsightCard extends PackageInsight {
  typeLabel: string
  summaryText: string
  totalBytesLabel: string
  compressedBytesLabel: string
  deltaText: string
  budgetText: string
  selected: boolean
  entryCountText: string
  metrics: DashboardMetricItem[]
}

const props = defineProps<{
  packageInsights: PackageInsight[]
  budgetWarnings: PackageBudgetWarning[]
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

function formatDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return '—'
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function createPackageMetrics(pkg: PackageInsight): DashboardMetricItem[] {
  return [
    { label: 'Chunks', value: pkg.chunkCount },
    { label: 'Assets', value: pkg.assetCount },
    { label: '压缩后', value: formatBytes(pkg.compressedBytes) },
    { label: '较上次', value: formatDelta(pkg.sizeDeltaBytes) },
  ]
}

const budgetWarningMap = computed(() => new Map(props.budgetWarnings.map(item => [item.id, item])))

const packageInsightCards = computed<PackageInsightCard[]>(() => props.packageInsights.map((pkg) => {
  const typeLabel = formatPackageType(pkg.type)
  const budgetWarning = budgetWarningMap.value.get(pkg.id)
  const selected = props.selectedTreemapMeta?.packageLabel === pkg.label

  return {
    ...pkg,
    typeLabel,
    summaryText: `${typeLabel} · ${pkg.fileCount} 个产物 · ${pkg.moduleCount} 个模块 · 跨包 ${pkg.duplicateModuleCount}`,
    totalBytesLabel: formatBytes(pkg.totalBytes),
    compressedBytesLabel: `${pkg.compressedSizeSource === 'real' ? 'Brotli' : '估算'} ${formatBytes(pkg.compressedBytes)}`,
    deltaText: formatDelta(pkg.sizeDeltaBytes),
    budgetText: budgetWarning
      ? `${budgetWarning.status === 'critical' ? '超预算' : '接近预算'} ${(budgetWarning.ratio * 100).toFixed(1)}%`
      : '预算正常',
    selected,
    entryCountText: `${pkg.entryFileCount} 个 entry`,
    metrics: createPackageMetrics(pkg),
  }
}))
</script>

<template>
  <section class="h-full min-h-0 overflow-hidden">
    <div class="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
      <article
        v-for="pkg in packageInsightCards"
        :key="pkg.id"
        :class="[
          surfaceStyles({ padding: 'md' }),
          pkg.selected ? 'border-(--dashboard-accent)' : '',
        ]"
        class="min-h-0 border transition"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <AppPanelHeader
              icon-name="tab-packages"
              :title="pkg.label"
              :description="pkg.typeLabel"
            />
            <p class="mt-2 text-sm text-(--dashboard-text-soft)">
              {{ pkg.summaryText }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xl font-semibold text-(--dashboard-text)">
              {{ pkg.totalBytesLabel }}
            </p>
            <p class="text-xs text-(--dashboard-text-soft)">
              {{ pkg.compressedBytesLabel }}
            </p>
            <p class="mt-1 text-xs text-(--dashboard-accent)">
              {{ pkg.budgetText }}
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <AppMetricTile
            v-for="metric in pkg.metrics"
            :key="metric.label"
            v-bind="metric"
          />
        </div>

        <div class="mt-4">
          <AppPackageFileTable :files="pkg.topFiles" />
        </div>
      </article>
    </div>
  </section>
</template>
