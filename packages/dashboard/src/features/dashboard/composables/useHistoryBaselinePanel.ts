import type { AnalyzeComparisonMode, AnalyzeHistorySnapshot } from '../types'
import { computed, ref } from 'vue'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import { createHistoryTrendSummary } from '../utils/historyTrend'
import { useDashboardActionStatus } from './useDashboardActionStatus'

export type HistorySnapshotSortMode = 'capturedAt' | 'total' | 'compressed' | 'modules' | 'duplicates'

interface HistoryBaselinePanelProps {
  snapshots: AnalyzeHistorySnapshot[]
  baselineSnapshotId: string | null
  comparisonMode: AnalyzeComparisonMode
}

function formatDelta(bytes: number) {
  if (bytes === 0) {
    return '无变化'
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function formatSnapshotDate(snapshot: AnalyzeHistorySnapshot) {
  return new Date(snapshot.capturedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getSnapshotKeyword(snapshot: AnalyzeHistorySnapshot) {
  return [
    snapshot.id,
    snapshot.label,
    snapshot.capturedAt,
    snapshot.packageCount,
    snapshot.moduleCount,
    snapshot.duplicateCount,
    snapshot.totalBytes,
    snapshot.compressedBytes,
  ].join(' ').toLowerCase()
}

function sortSnapshots(
  snapshots: AnalyzeHistorySnapshot[],
  mode: HistorySnapshotSortMode,
) {
  return [...snapshots].sort((a, b) => {
    if (mode === 'total') {
      return b.totalBytes - a.totalBytes || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
    }
    if (mode === 'compressed') {
      return b.compressedBytes - a.compressedBytes || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
    }
    if (mode === 'modules') {
      return b.moduleCount - a.moduleCount || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
    }
    if (mode === 'duplicates') {
      return b.duplicateCount - a.duplicateCount || Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
    }
    return Date.parse(b.capturedAt) - Date.parse(a.capturedAt)
  })
}

export function useHistoryBaselinePanel(props: HistoryBaselinePanelProps) {
  const snapshotQuery = ref('')
  const snapshotSortMode = ref<HistorySnapshotSortMode>('capturedAt')
  const { actionStatus, setActionStatus } = useDashboardActionStatus()

  const baselineSnapshot = computed(() => props.snapshots.find(snapshot => snapshot.id === props.baselineSnapshotId) ?? null)
  const currentSnapshot = computed(() => props.snapshots[0] ?? null)
  const previousSnapshot = computed(() => props.snapshots[1] ?? null)
  const historyTrend = computed(() => createHistoryTrendSummary(props.snapshots))

  const baselineDelta = computed(() => {
    if (!currentSnapshot.value || !baselineSnapshot.value) {
      return ''
    }
    return formatDelta(currentSnapshot.value.totalBytes - baselineSnapshot.value.totalBytes)
  })

  const previousDelta = computed(() => {
    if (!currentSnapshot.value || !previousSnapshot.value) {
      return ''
    }
    return formatDelta(currentSnapshot.value.totalBytes - previousSnapshot.value.totalBytes)
  })

  const activeComparisonLabel = computed(() => {
    if (props.comparisonMode === 'baseline') {
      return baselineDelta.value || '未设置'
    }
    return previousDelta.value || '上次快照'
  })

  const baselineSummaryItems = computed(() => {
    const snapshot = baselineSnapshot.value
    if (!snapshot) {
      return []
    }
    return [
      { label: '基线体积', value: formatBytes(snapshot.totalBytes) },
      { label: '压缩后', value: formatBytes(snapshot.compressedBytes) },
      { label: '模块数', value: String(snapshot.moduleCount) },
      { label: '复用模块', value: String(snapshot.duplicateCount) },
    ]
  })

  const filteredSnapshots = computed(() => {
    const keyword = snapshotQuery.value.trim().toLowerCase()
    const snapshots = props.snapshots.filter(snapshot => !keyword || getSnapshotKeyword(snapshot).includes(keyword))
    return sortSnapshots(snapshots, snapshotSortMode.value)
  })

  const baselineReportText = computed(() => {
    const current = currentSnapshot.value
    const baseline = baselineSnapshot.value
    const previous = previousSnapshot.value
    return [
      '# dashboard 历史基线',
      '',
      current ? `当前快照：${formatSnapshotDate(current)} · ${formatBytes(current.totalBytes)} · 压缩后 ${formatBytes(current.compressedBytes)}` : '当前快照：暂无',
      baseline ? `基线快照：${formatSnapshotDate(baseline)} · ${formatBytes(baseline.totalBytes)} · 压缩后 ${formatBytes(baseline.compressedBytes)}` : '基线快照：未设置',
      previous ? `上次快照：${formatSnapshotDate(previous)} · ${formatBytes(previous.totalBytes)} · 压缩后 ${formatBytes(previous.compressedBytes)}` : '上次快照：暂无',
      `当前对比：${activeComparisonLabel.value}`,
      '',
      '| 时间 | 总体积 | 压缩后 | 包 | 模块 | 复用模块 |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...filteredSnapshots.value.map(snapshot => `| ${formatSnapshotDate(snapshot)} | ${formatBytes(snapshot.totalBytes)} | ${formatBytes(snapshot.compressedBytes)} | ${snapshot.packageCount} | ${snapshot.moduleCount} | ${snapshot.duplicateCount} |`),
      '',
    ].join('\n')
  })

  async function copyBaselineReport() {
    try {
      await copyText(baselineReportText.value)
      setActionStatus('已复制')
    }
    catch {
      setActionStatus('复制失败')
    }
  }

  function exportFilteredSnapshots() {
    const blob = new Blob([`${JSON.stringify(filteredSnapshots.value, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'weapp-vite-dashboard-history.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setActionStatus('已导出')
  }

  return {
    actionStatus,
    activeComparisonLabel,
    baselineSnapshot,
    baselineSummaryItems,
    copyBaselineReport,
    exportFilteredSnapshots,
    filteredSnapshots,
    formatSnapshotDate,
    historyTrend,
    snapshotQuery,
    snapshotSortMode,
  }
}
