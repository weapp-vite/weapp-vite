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

  const topCards = computed<DashboardMetricCard[]>(() => {
    if (activeTab.value === 'packages') {
      return [
        { label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'metric-packages' },
        { label: '分包配置', value: String(options.summary.value.subpackageCount), iconName: 'metric-subpackages' },
        { label: 'Chunk 数量', value: String(totalChunkCount.value), iconName: 'metric-chunks' },
        { label: 'Asset 数量', value: String(totalAssetCount.value), iconName: 'metric-assets' },
        { label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), wide: true, iconName: 'metric-size-outline' },
      ]
    }

    if (activeTab.value === 'modules') {
      return [
        { label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' },
        { label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' },
        { label: '来源类型', value: String(options.moduleSourceSummary.value.length), iconName: 'metric-sources' },
        { label: '复用体积', value: duplicateBytes.value > 0 ? formatBytes(duplicateBytes.value) : '0 B', iconName: 'metric-copy' },
        { label: '最近刷新', value: options.lastUpdatedAt.value, wide: true, iconName: 'metric-time' },
      ]
    }

    return [
      { label: '包体数量', value: String(options.summary.value.packageCount), iconName: 'tab-packages' },
      { label: '源码模块', value: String(options.summary.value.moduleCount), iconName: 'metric-modules' },
      { label: '跨包复用', value: String(options.summary.value.duplicateCount), iconName: 'metric-duplicates' },
      { label: 'Entry 数量', value: String(options.summary.value.entryCount), iconName: 'metric-entries' },
      { label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), wide: true, iconName: 'metric-size' },
    ]
  })

  return {
    activeTab,
    topCards,
    packageTypeSummary: options.packageTypeSummary,
  }
}
