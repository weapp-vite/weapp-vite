<script setup lang="ts">
import type { DashboardMetricItem, PackageBudgetWarning, PackageInsight, PackageType, TreemapNodeMeta } from '../types'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes, formatPackageType } from '../utils/format'
import { createPackageHealthSummary } from '../utils/packageHealth'
import { surfaceStyles } from '../utils/styles'
import AppEmptyState from './AppEmptyState.vue'
import AppMetricTile from './AppMetricTile.vue'
import AppPackageFileTable from './AppPackageFileTable.vue'
import AppPanelHeader from './AppPanelHeader.vue'
import PackageExplorerToolbar from './PackageExplorerToolbar.vue'
import PackageHealthPanel from './PackageHealthPanel.vue'

type PackageFilterType = 'all' | PackageType
type PackageBudgetFilter = 'all' | 'warning' | 'normal'
type PackageSortMode = 'health' | 'size' | 'compressed' | 'delta' | 'duplicates' | 'files' | 'name'

interface PackageInsightCard extends PackageInsight {
  typeLabel: string
  summaryText: string
  totalBytesLabel: string
  compressedBytesLabel: string
  deltaText: string
  budgetText: string
  selected: boolean
  entryCountText: string
  healthScore: number
  metrics: DashboardMetricItem[]
}

const props = defineProps<{
  packageInsights: PackageInsight[]
  budgetWarnings: PackageBudgetWarning[]
  selectedTreemapMeta: TreemapNodeMeta | null
}>()

const packageQuery = ref('')
const packageTypeFilter = ref<PackageFilterType>('all')
const packageBudgetFilter = ref<PackageBudgetFilter>('all')
const packageSortMode = ref<PackageSortMode>('size')
const actionStatus = ref('')
let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

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

function escapeMarkdownCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ')
}

const budgetWarningMap = computed(() => new Map(props.budgetWarnings.map(item => [item.id, item])))
const packageHealth = computed(() => createPackageHealthSummary({
  packageInsights: props.packageInsights,
  budgetWarnings: props.budgetWarnings,
}))
const packageHealthScoreMap = computed(() => new Map(packageHealth.value.items.map(item => [item.id, item.score])))
const packageTypeOptions = computed(() => {
  const typeSet = new Set<PackageType>()
  for (const pkg of props.packageInsights) {
    typeSet.add(pkg.type)
  }
  return [...typeSet].sort((a, b) => formatPackageType(a).localeCompare(formatPackageType(b)))
})

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
    healthScore: packageHealthScoreMap.value.get(pkg.id) ?? 100,
    metrics: createPackageMetrics(pkg),
  }
}))

const filteredPackageInsightCards = computed(() => {
  const keyword = packageQuery.value.trim().toLowerCase()
  return packageInsightCards.value
    .filter((pkg) => {
      if (packageTypeFilter.value !== 'all' && pkg.type !== packageTypeFilter.value) {
        return false
      }
      const hasWarning = budgetWarningMap.value.has(pkg.id)
      if (packageBudgetFilter.value === 'warning' && !hasWarning) {
        return false
      }
      if (packageBudgetFilter.value === 'normal' && hasWarning) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        pkg.id,
        pkg.label,
        pkg.type,
        pkg.typeLabel,
        pkg.summaryText,
      ].some(value => value.toLowerCase().includes(keyword))
    })
    .sort((a, b) => {
      if (packageSortMode.value === 'compressed') {
        return b.compressedBytes - a.compressedBytes || a.label.localeCompare(b.label)
      }
      if (packageSortMode.value === 'delta') {
        return (b.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) - (a.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) || a.label.localeCompare(b.label)
      }
      if (packageSortMode.value === 'duplicates') {
        return b.duplicateModuleCount - a.duplicateModuleCount || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
      }
      if (packageSortMode.value === 'files') {
        return b.fileCount - a.fileCount || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
      }
      if (packageSortMode.value === 'name') {
        return a.label.localeCompare(b.label)
      }
      if (packageSortMode.value === 'health') {
        return a.healthScore - b.healthScore || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
      }
      return b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
    })
})

const packageReportText = computed(() => [
  '# dashboard 包体探索',
  '',
  `包数量：${filteredPackageInsightCards.value.length} / ${packageInsightCards.value.length}`,
  '',
  '| 包 | 类型 | 总体积 | 压缩后 | 较上次 | 预算 | 产物 | 模块 | 重复模块 |',
  '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
  ...filteredPackageInsightCards.value.map(pkg => [
    pkg.label,
    pkg.typeLabel,
    pkg.totalBytesLabel,
    pkg.compressedBytesLabel,
    pkg.deltaText,
    pkg.budgetText,
    String(pkg.fileCount),
    String(pkg.moduleCount),
    String(pkg.duplicateModuleCount),
  ].map(escapeMarkdownCell).join(' | ')).map(row => `| ${row} |`),
  '',
].join('\n'))

function setActionStatus(status: string) {
  actionStatus.value = status
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
  actionStatusTimer = setTimeout(() => {
    actionStatus.value = ''
    actionStatusTimer = null
  }, 1800)
}

async function copyPackageReport() {
  try {
    await copyText(packageReportText.value)
    setActionStatus('已复制')
  }
  catch {
    setActionStatus('复制失败')
  }
}

function exportPackageJson() {
  const blob = new Blob([`${JSON.stringify(filteredPackageInsightCards.value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'weapp-vite-dashboard-packages.json'
  anchor.click()
  URL.revokeObjectURL(url)
  setActionStatus('已导出')
}

onBeforeUnmount(() => {
  if (actionStatusTimer) {
    clearTimeout(actionStatusTimer)
  }
})
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
    <div class="grid gap-3">
      <PackageHealthPanel :health="packageHealth" />

      <div :class="surfaceStyles({ padding: 'md' })" class="grid gap-3">
        <AppPanelHeader
          icon-name="tab-packages"
          title="包体探索"
          :description="`${packageInsightCards.length} 个包体样本`"
        />
        <PackageExplorerToolbar
          v-model:budget-filter="packageBudgetFilter"
          v-model:query="packageQuery"
          v-model:sort-mode="packageSortMode"
          v-model:type-filter="packageTypeFilter"
          :action-status="actionStatus"
          :disabled="filteredPackageInsightCards.length === 0"
          :filtered-count="filteredPackageInsightCards.length"
          :total-count="packageInsightCards.length"
          :type-options="packageTypeOptions"
          @copy="copyPackageReport"
          @export-json="exportPackageJson"
        />
      </div>
    </div>

    <div class="grid min-h-0 auto-rows-max gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
      <AppEmptyState v-if="filteredPackageInsightCards.length === 0" class="xl:col-span-2">
        没有匹配当前筛选条件的包。
      </AppEmptyState>

      <article
        v-for="pkg in filteredPackageInsightCards"
        :key="pkg.id"
        :class="[
          surfaceStyles({ padding: 'md' }),
          pkg.selected ? 'border-(--dashboard-accent)' : '',
        ]"
        class="border transition"
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
