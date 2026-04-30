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
      if (value === 'packages' || value === 'modules') {
        return value
      }
      return 'overview'
    },
    set(value) {
      void router.replace({
        query: value === 'overview'
          ? {}
          : { tab: value },
      })
    },
  })

  const totalChunkCount = computed(() => options.packageInsights.value.reduce((sum, pkg) => sum + pkg.chunkCount, 0))
  const totalAssetCount = computed(() => options.packageInsights.value.reduce((sum, pkg) => sum + pkg.assetCount, 0))
  const duplicateBytes = computed(() => options.duplicateModules.value.reduce((sum, mod) => sum + mod.bytes, 0))
  const estimatedCompressedText = computed(() => `估算压缩后 ${formatBytes(options.summary.value.estimatedCompressedBytes)}`)

  function createPackagesTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'metric-packages' }),
      createMetricCard({ label: '分包配置', value: String(options.summary.value.subpackageCount), iconName: 'metric-subpackages' }),
      createMetricCard({ label: 'Chunk 数量', value: String(totalChunkCount.value), iconName: 'metric-chunks' }),
      createMetricCard({ label: 'Asset 数量', value: String(totalAssetCount.value), iconName: 'metric-assets' }),
      createMetricCard({ label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), detail: estimatedCompressedText.value, wide: true, iconName: 'metric-size-outline' }),
    ]
  }

  function createModulesTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' }),
      createMetricCard({ label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' }),
      createMetricCard({ label: '来源类型', value: String(options.moduleSourceSummary.value.length), iconName: 'metric-sources' }),
      createMetricCard({ label: '复用体积', value: duplicateBytes.value > 0 ? formatBytes(duplicateBytes.value) : '0 B', iconName: 'metric-copy' }),
      createMetricCard({ label: '最近刷新', value: options.lastUpdatedAt.value, wide: true, iconName: 'metric-time' }),
    ]
  }

  function createOverviewTopCards(): DashboardMetricCard[] {
    return [
      createMetricCard({ label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'tab-packages' }),
      createMetricCard({ label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' }),
      createMetricCard({ label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' }),
      createMetricCard({ label: 'Entry 数量', value: String(options.summary.value.entryCount), iconName: 'metric-entries' }),
      createMetricCard({ label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), detail: estimatedCompressedText.value, wide: true, iconName: 'metric-size' }),
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
