import type { AnalyzeActionCenterItem, LargestFileEntry, PackageInsight } from '../types'
import { computed } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes, formatPackageType } from '../utils/format'
import { createReleaseGateSummary } from '../utils/releaseGate'
import { getActionToneClassName, getActionToneLabel } from './useActionCenterPanel'
import { useDashboardActionStatus } from './useDashboardActionStatus'

interface PackageOverviewItem extends PackageInsight {
  typeLabel: string
  sizeLabel: string
  compressedLabel: string
  sharePercent: number
  shareStyle: Record<string, string>
}

interface AnalyzeOverviewPanelProps {
  actionItems: AnalyzeActionCenterItem[]
  largestFiles: LargestFileEntry[]
  packageInsights: PackageInsight[]
}

export function useAnalyzeOverviewPanel(props: AnalyzeOverviewPanelProps) {
  const visibleActions = computed(() => props.actionItems.slice(0, 4))
  const visibleLargestFiles = computed(() => props.largestFiles.slice(0, 5))
  const totalPackageBytes = computed(() => props.packageInsights.reduce((sum, item) => sum + item.totalBytes, 0))
  const releaseGate = computed(() => createReleaseGateSummary({
    actionItems: props.actionItems,
    largestFiles: props.largestFiles,
    packageInsights: props.packageInsights,
  }))
  const {
    actionStatus: gateCopyStatus,
    setActionStatus: setGateCopyStatus,
  } = useDashboardActionStatus()

  const packageOverviewItems = computed<PackageOverviewItem[]>(() => props.packageInsights.slice(0, 5).map((item) => {
    const sharePercent = totalPackageBytes.value > 0
      ? item.totalBytes / totalPackageBytes.value * 100
      : 0

    return {
      ...item,
      typeLabel: formatPackageType(item.type),
      sizeLabel: formatBytes(item.totalBytes),
      compressedLabel: `${item.compressedSizeSource === 'real' ? 'Brotli' : '估算'} ${formatBytes(item.compressedBytes)}`,
      sharePercent,
      shareStyle: {
        width: `${Math.max(sharePercent, 2).toFixed(1)}%`,
      },
    }
  }))

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
    copyReleaseGateReport,
    gateCopyStatus,
    getToneClassName: getActionToneClassName,
    getToneLabel: getActionToneLabel,
    packageOverviewItems,
    releaseGate,
    visibleActions,
    visibleLargestFiles,
  }
}
