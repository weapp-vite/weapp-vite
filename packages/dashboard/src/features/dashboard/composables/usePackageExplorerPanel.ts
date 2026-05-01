import type { DashboardMetricItem, PackageBudgetWarning, PackageInsight, PackageType, TreemapNodeMeta } from '../types'
import { computed, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes, formatPackageType } from '../utils/format'
import { createPackageHealthSummary } from '../utils/packageHealth'
import { useDashboardActionStatus } from './useDashboardActionStatus'

export type PackageFilterType = 'all' | PackageType
export type PackageBudgetFilter = 'all' | 'warning' | 'normal'
export type PackageSortMode = 'health' | 'size' | 'compressed' | 'delta' | 'duplicates' | 'files' | 'name'

export interface PackageInsightCard extends PackageInsight {
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

interface PackageExplorerPanelProps {
  packageInsights: PackageInsight[]
  budgetWarnings: PackageBudgetWarning[]
  selectedTreemapMeta: TreemapNodeMeta | null
}

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

function createPackageReportText(cards: PackageInsightCard[], totalCount: number) {
  return [
    '# dashboard 包体探索',
    '',
    `包数量：${cards.length} / ${totalCount}`,
    '',
    '| 包 | 类型 | 总体积 | 压缩后 | 较上次 | 预算 | 产物 | 模块 | 重复模块 |',
    '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |',
    ...cards.map(pkg => [
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
  ].join('\n')
}

function sortPackageInsightCards(
  cards: PackageInsightCard[],
  mode: PackageSortMode,
) {
  return [...cards].sort((a, b) => {
    if (mode === 'compressed') {
      return b.compressedBytes - a.compressedBytes || a.label.localeCompare(b.label)
    }
    if (mode === 'delta') {
      return (b.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) - (a.sizeDeltaBytes ?? Number.NEGATIVE_INFINITY) || a.label.localeCompare(b.label)
    }
    if (mode === 'duplicates') {
      return b.duplicateModuleCount - a.duplicateModuleCount || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
    }
    if (mode === 'files') {
      return b.fileCount - a.fileCount || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
    }
    if (mode === 'name') {
      return a.label.localeCompare(b.label)
    }
    if (mode === 'health') {
      return a.healthScore - b.healthScore || b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
    }
    return b.totalBytes - a.totalBytes || a.label.localeCompare(b.label)
  })
}

export function usePackageExplorerPanel(props: PackageExplorerPanelProps) {
  const packageQuery = ref('')
  const packageTypeFilter = ref<PackageFilterType>('all')
  const packageBudgetFilter = ref<PackageBudgetFilter>('all')
  const packageSortMode = ref<PackageSortMode>('size')
  const { actionStatus, setActionStatus } = useDashboardActionStatus()

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
    const cards = packageInsightCards.value.filter((pkg) => {
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
    return sortPackageInsightCards(cards, packageSortMode.value)
  })

  const packageReportText = computed(() => createPackageReportText(
    filteredPackageInsightCards.value,
    packageInsightCards.value.length,
  ))

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

  return {
    actionStatus,
    copyPackageReport,
    exportPackageJson,
    filteredPackageInsightCards,
    packageBudgetFilter,
    packageHealth,
    packageInsightCards,
    packageQuery,
    packageSortMode,
    packageTypeFilter,
    packageTypeOptions,
  }
}
