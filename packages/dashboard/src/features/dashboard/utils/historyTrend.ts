import type { AnalyzeHistorySnapshot, DashboardMetricItem } from '../types'
import { formatBytes } from './format'

export type HistoryTrendStatus = 'growing' | 'shrinking' | 'stable' | 'insufficient'

export interface HistoryTrendSummary {
  status: HistoryTrendStatus
  label: string
  headline: string
  description: string
  totalDeltaBytes: number
  averageDeltaBytes: number
  projectedNextBytes?: number
  metrics: DashboardMetricItem[]
}

function formatSignedBytes(bytes: number) {
  if (bytes === 0) {
    return '0 B'
  }
  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function getStatus(totalDeltaBytes: number, averageDeltaBytes: number): HistoryTrendStatus {
  if (totalDeltaBytes === 0 && averageDeltaBytes === 0) {
    return 'stable'
  }
  if (averageDeltaBytes > 0) {
    return 'growing'
  }
  if (averageDeltaBytes < 0) {
    return 'shrinking'
  }
  return 'stable'
}

function getStatusLabel(status: HistoryTrendStatus) {
  if (status === 'growing') {
    return '增长'
  }
  if (status === 'shrinking') {
    return '下降'
  }
  if (status === 'stable') {
    return '稳定'
  }
  return '样本不足'
}

function createHeadline(status: HistoryTrendStatus) {
  if (status === 'growing') {
    return '历史快照显示体积正在上升'
  }
  if (status === 'shrinking') {
    return '历史快照显示体积正在下降'
  }
  if (status === 'stable') {
    return '历史快照整体保持稳定'
  }
  return '需要更多历史快照判断趋势'
}

export function createHistoryTrendSummary(snapshots: AnalyzeHistorySnapshot[]): HistoryTrendSummary {
  const orderedSnapshots = [...snapshots].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
  const first = orderedSnapshots[0]
  const latest = orderedSnapshots.at(-1)

  if (!first || !latest || orderedSnapshots.length < 2) {
    return {
      status: 'insufficient',
      label: getStatusLabel('insufficient'),
      headline: createHeadline('insufficient'),
      description: `${orderedSnapshots.length} 个历史样本`,
      totalDeltaBytes: 0,
      averageDeltaBytes: 0,
      metrics: [
        { label: '样本数', value: orderedSnapshots.length },
        { label: '累计变化', value: '—' },
        { label: '平均变化', value: '—' },
        { label: '预测下次', value: '—' },
      ],
    }
  }

  const deltas = orderedSnapshots.slice(1).map((snapshot, index) => snapshot.totalBytes - orderedSnapshots[index]!.totalBytes)
  const totalDeltaBytes = latest.totalBytes - first.totalBytes
  const averageDeltaBytes = Math.round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length)
  const projectedNextBytes = Math.max(0, latest.totalBytes + averageDeltaBytes)
  const status = getStatus(totalDeltaBytes, averageDeltaBytes)

  return {
    status,
    label: getStatusLabel(status),
    headline: createHeadline(status),
    description: `${orderedSnapshots.length} 个历史样本 · ${first.label} 至 ${latest.label}`,
    totalDeltaBytes,
    averageDeltaBytes,
    projectedNextBytes,
    metrics: [
      { label: '样本数', value: orderedSnapshots.length },
      { label: '累计变化', value: formatSignedBytes(totalDeltaBytes) },
      { label: '平均变化', value: formatSignedBytes(averageDeltaBytes) },
      { label: '预测下次', value: formatBytes(projectedNextBytes) },
    ],
  }
}
