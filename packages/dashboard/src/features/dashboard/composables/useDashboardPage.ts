import type { ComputedRef, Ref } from 'vue'
import type {
  AnalyzeDashboardSummary,
  DashboardMetricCard,
  DashboardTab,
  DuplicateModuleEntry,
  ModuleSourceSummary,
  PackageInsight,
  SummaryMetric,
} from '../types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatBytes } from '../utils/format'

function createMetricCard(card: DashboardMetricCard): DashboardMetricCard {
  return card
}

function formatDelta(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes === 0) {
    return ''
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

export function useDashboardPage(options: {
  summary: ComputedRef<AnalyzeDashboardSummary>
  packageInsights: ComputedRef<PackageInsight[]>
  packageTypeSummary: ComputedRef<SummaryMetric[]>
  duplicateModules: ComputedRef<DuplicateModuleEntry[]>
  moduleSourceSummary: ComputedRef<ModuleSourceSummary[]>
  lastUpdatedAt: Ref<string>
}) {
  const route = useRoute()
  const router = useRouter()

  const activeTab = computed<DashboardTab>({
    get() {
      const value = route.query.tab
      if (value === 'diagnostics' || value === 'treemap' || value === 'files' || value === 'source' || value === 'packages' || value === 'modules') {
        return value
      }
      return 'overview'
    },
    set(value) {
      const query = { ...route.query }
      if (value === 'overview') {
        delete query.tab
      }
      else {
        query.tab = value
      }
      void router.replace({
        query,
      })
    },
  })

  const totalChunkCount = computed(() => options.packageInsights.value.reduce((sum, pkg) => sum + pkg.chunkCount, 0))
  const totalAssetCount = computed(() => options.packageInsights.value.reduce((sum, pkg) => sum + pkg.assetCount, 0))
  const duplicateBytes = computed(() => options.duplicateModules.value.reduce((sum, mod) => sum + mod.bytes, 0))
  const compressedText = computed(() => {
    const summary = options.summary.value
    const prefix = summary.compressedSizeSource === 'real' ? 'Brotli' : '估算压缩后'
    const delta = formatDelta(summary.compressedDeltaBytes)
    return `${prefix} ${formatBytes(summary.compressedBytes)}${delta ? ` · ${delta}` : ''}`
  })
  const totalSizeDetail = computed(() => {
    const delta = formatDelta(options.summary.value.sizeDeltaBytes)
    return delta ? `较上次 ${delta}` : compressedText.value
  })

  function createPackagesTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'metric-packages' }),
      createMetricCard({ label: '分包配置', value: String(options.summary.value.subpackageCount), iconName: 'metric-subpackages' }),
      createMetricCard({ label: 'Chunk 数量', value: String(totalChunkCount.value), iconName: 'metric-chunks' }),
      createMetricCard({ label: 'Asset 数量', value: String(totalAssetCount.value), iconName: 'metric-assets' }),
      createMetricCard({ label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), detail: compressedText.value, wide: true, iconName: 'metric-size-outline' }),
    ]
  }

  function createModulesTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' }),
      createMetricCard({ label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' }),
      createMetricCard({ label: '来源类型', value: String(options.moduleSourceSummary.value.length), iconName: 'metric-sources' }),
      createMetricCard({ label: '复用体积', value: duplicateBytes.value > 0 ? formatBytes(duplicateBytes.value) : '0 B', iconName: 'metric-copy' }),
      createMetricCard({ label: '预算告警', value: String(options.summary.value.budgetWarningCount), detail: totalSizeDetail.value, wide: true, iconName: 'metric-time' }),
    ]
  }

  function createOverviewTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'tab-packages' }),
      createMetricCard({ label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' }),
      createMetricCard({ label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' }),
      createMetricCard({ label: '预算告警', value: String(options.summary.value.budgetWarningCount), iconName: 'metric-entries' }),
      createMetricCard({ label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), detail: compressedText.value, wide: true, iconName: 'metric-size' }),
    ]
  }

  const topCards = computed<DashboardMetricCard[]>(() => {
    if (activeTab.value === 'packages') {
      return createPackagesTopCards()
    }

    if (activeTab.value === 'modules') {
      return createModulesTopCards()
    }

    return createOverviewTopCards()
  })

  return {
    activeTab,
    topCards,
    packageTypeSummary: options.packageTypeSummary,
  }
}
