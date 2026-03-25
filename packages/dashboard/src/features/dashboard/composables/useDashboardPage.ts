import type { ComputedRef, Ref } from 'vue'
import type { DashboardMetricCard, DashboardTab } from '../types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatBytes } from '../utils/format'

export function useDashboardPage(options: {
  summary: ComputedRef<{
    packageCount: number
    moduleCount: number
    duplicateCount: number
    totalBytes: number
    subpackageCount: number
    entryCount: number
  }>
  packageInsights: ComputedRef<Array<{ chunkCount: number, assetCount: number }>>
  packageTypeSummary: ComputedRef<Array<{ label: string, value: number }>>
  duplicateModules: ComputedRef<Array<{ bytes: number }>>
  moduleSourceSummary: ComputedRef<Array<unknown>>
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
        { label: '包体数量', value: String(options.summary.value.packageCount), iconClass: 'icon-[mdi--package-variant]' },
        { label: '分包配置', value: String(options.summary.value.subpackageCount), iconClass: 'icon-[mdi--layers-triple-outline]' },
        { label: 'Chunk 数量', value: String(totalChunkCount.value), iconClass: 'icon-[mdi--chart-tree]' },
        { label: 'Asset 数量', value: String(totalAssetCount.value), iconClass: 'icon-[mdi--file-document-multiple-outline]' },
        { label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), wide: true, iconClass: 'icon-[mdi--database-outline]' },
      ]
    }

    if (activeTab.value === 'modules') {
      return [
        { label: '源码模块', value: String(options.summary.value.moduleCount), iconClass: 'icon-[mdi--cube-outline]' },
        { label: '跨包复用', value: String(options.summary.value.duplicateCount), iconClass: 'icon-[mdi--vector-link]' },
        { label: '来源类型', value: String(options.moduleSourceSummary.value.length), iconClass: 'icon-[mdi--source-branch]' },
        { label: '复用体积', value: duplicateBytes.value > 0 ? formatBytes(duplicateBytes.value) : '0 B', iconClass: 'icon-[mdi--content-copy]' },
        { label: '最近刷新', value: options.lastUpdatedAt.value, wide: true, iconClass: 'icon-[mdi--clock-outline]' },
      ]
    }

    return [
      { label: '包体数量', value: String(options.summary.value.packageCount), iconClass: 'icon-[mdi--package-variant-closed]' },
      { label: '源码模块', value: String(options.summary.value.moduleCount), iconClass: 'icon-[mdi--cube-scan]' },
      { label: '跨包复用', value: String(options.summary.value.duplicateCount), iconClass: 'icon-[mdi--vector-difference]' },
      { label: 'Entry 数量', value: String(options.summary.value.entryCount), iconClass: 'icon-[mdi--export-variant]' },
      { label: '总产物体积', value: formatBytes(options.summary.value.totalBytes), wide: true, iconClass: 'icon-[mdi--database]' },
    ]
  })

  return {
    activeTab,
    topCards,
    packageTypeSummary: options.packageTypeSummary,
  }
}
