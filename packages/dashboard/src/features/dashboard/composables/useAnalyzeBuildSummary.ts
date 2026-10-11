import type { AnalyzeActionCenterItem, LargestFileEntry, PackageInsight } from '../types'
import { computed } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes, formatPackageType } from '../utils/format'
import { createReleaseGateSummary } from '../utils/releaseGate'
import { useDashboardActionStatus } from './useDashboardActionStatus'

interface PackageOverviewItem extends PackageInsight {
  typeLabel: string
  sizeLabel: string
  compressedLabel: string
  deltaLabel: string
  shareStyle: Record<string, string>
}

interface AnalyzeBuildSummaryProps {
  actionItems: AnalyzeActionCenterItem[]
  largestFiles: LargestFileEntry[]
  packageInsights: PackageInsight[]
}

export function useAnalyzeBuildSummary(props: AnalyzeBuildSummaryProps) {
  const totalPackageBytes = computed(() => props.packageInsights.reduce((sum, item) => sum + item.totalBytes, 0))
  const totalPackageBytesLabel = computed(() => props.packageInsights.length > 0 ? formatBytes(totalPackageBytes.value) : '—')
  const budgetSummary = computed(() => {
    const budgetActions = props.actionItems.filter(item => item.kind === 'budget')
    const unknownCount = budgetActions.filter(item => item.measurementUnknown || item.warning?.status === 'unknown').length
    if (unknownCount > 0) {
      return `预算告警 ${budgetActions.length} 项 · ${unknownCount} 项测量待确认`
    }
    if (budgetActions.length > 0) {
      return `预算告警 ${budgetActions.length} 项`
    }
    return props.packageInsights.length > 0 ? '未发现预算告警' : '预算暂无数据'
  })
  const releaseGate = computed(() => createReleaseGateSummary({
    actionItems: props.actionItems,
    largestFiles: props.largestFiles,
    packageInsights: props.packageInsights,
  }))
  const {
    actionStatus: gateCopyStatus,
    setActionStatus: setGateCopyStatus,
  } = useDashboardActionStatus()

  const packageOverviewItems = computed<PackageOverviewItem[]>(() => props.packageInsights.map((item) => {
    const sharePercent = totalPackageBytes.value > 0
      ? item.totalBytes / totalPackageBytes.value * 100
      : 0

    return {
      ...item,
      typeLabel: formatPackageType(item.type),
      sizeLabel: formatBytes(item.totalBytes),
      compressedLabel: `${item.compressedSizeSource === 'real' ? 'Brotli' : '估算'} ${formatBytes(item.compressedBytes)}`,
      deltaLabel: typeof item.sizeDeltaBytes === 'number'
        ? `较基线 ${item.sizeDeltaBytes >= 0 ? '+' : '−'}${formatBytes(Math.abs(item.sizeDeltaBytes))}`
        : '',
      shareStyle: {
        width: `${sharePercent}%`,
      },
    }
  }).sort((a, b) => b.totalBytes - a.totalBytes))
  const packagePreviewItems = computed(() => packageOverviewItems.value.slice(0, 3))

  async function copyReleaseGateReport() {
    try {
      await copyText(releaseGate.value.report)
      setGateCopyStatus('已复制')
    }
    catch {
      setGateCopyStatus('复制失败')
    }
  }

  return {
    budgetSummary,
    copyReleaseGateReport,
    gateCopyStatus,
    packageOverviewItems,
    packagePreviewItems,
    releaseGate,
    totalPackageBytesLabel,
  }
}
