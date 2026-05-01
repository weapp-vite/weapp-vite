import type { AnalyzeActionCenterItem, DashboardMetricItem, LargestFileEntry, PackageInsight } from '../types'
import { formatBytes } from './format'

export type ReleaseGateStatus = 'ready' | 'review' | 'blocked'

export interface ReleaseGateSummary {
  status: ReleaseGateStatus
  label: string
  score: number
  headline: string
  description: string
  metrics: DashboardMetricItem[]
  recommendations: string[]
  report: string
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getStatusLabel(status: ReleaseGateStatus) {
  if (status === 'blocked') {
    return 'Blocked'
  }
  if (status === 'review') {
    return 'Review'
  }
  return 'Ready'
}

function createHeadline(status: ReleaseGateStatus) {
  if (status === 'blocked') {
    return '发布前需要先处理阻断项'
  }
  if (status === 'review') {
    return '建议评审后再发布'
  }
  return '当前分析未发现阻断项'
}

function createRecommendations(options: {
  criticalActions: AnalyzeActionCenterItem[]
  warningActions: AnalyzeActionCenterItem[]
  largestFile?: LargestFileEntry
  largestPackage?: PackageInsight
}) {
  const recommendations: string[] = []
  for (const item of [...options.criticalActions, ...options.warningActions].slice(0, 3)) {
    recommendations.push(`${item.title}：${item.meta}`)
  }
  if (recommendations.length === 0 && options.largestPackage) {
    recommendations.push(`持续关注最大包 ${options.largestPackage.label}，当前 ${formatBytes(options.largestPackage.totalBytes)}。`)
  }
  if (recommendations.length === 0 && options.largestFile) {
    recommendations.push(`持续关注最大文件 ${options.largestFile.file}，当前 ${formatBytes(options.largestFile.size)}。`)
  }
  return recommendations
}

function createGateReport(summary: Omit<ReleaseGateSummary, 'report'>) {
  return [
    '# dashboard 发布门禁',
    '',
    `状态：${summary.label}`,
    `风险分：${summary.score}`,
    summary.headline,
    '',
    '## 指标',
    '',
    ...summary.metrics.map(item => `- ${item.label}：${item.value}`),
    '',
    '## 建议',
    '',
    ...(summary.recommendations.length > 0 ? summary.recommendations.map(item => `- ${item}`) : ['- 当前没有需要立即处理的事项。']),
    '',
  ].join('\n')
}

export function createReleaseGateSummary(options: {
  actionItems: AnalyzeActionCenterItem[]
  largestFiles: LargestFileEntry[]
  packageInsights: PackageInsight[]
}): ReleaseGateSummary {
  const criticalActions = options.actionItems.filter(item => item.tone === 'critical')
  const warningActions = options.actionItems.filter(item => item.tone === 'warning')
  const largestFile = options.largestFiles[0]
  const largestPackage = options.packageInsights[0]
  const status: ReleaseGateStatus = criticalActions.length > 0
    ? 'blocked'
    : warningActions.length > 0
      ? 'review'
      : 'ready'
  const score = clampScore(100 - criticalActions.length * 28 - warningActions.length * 12)
  const metrics: DashboardMetricItem[] = [
    { label: '阻断项', value: criticalActions.length },
    { label: '建议项', value: warningActions.length },
    { label: '最大包', value: largestPackage ? formatBytes(largestPackage.totalBytes) : '—' },
    { label: '最大文件', value: largestFile ? formatBytes(largestFile.size) : '—' },
  ]
  const summary = {
    status,
    label: getStatusLabel(status),
    score,
    headline: createHeadline(status),
    description: `${options.actionItems.length} 个候选事项 · ${options.packageInsights.length} 个包 · ${options.largestFiles.length} 个文件样本`,
    metrics,
    recommendations: createRecommendations({
      criticalActions,
      warningActions,
      largestFile,
      largestPackage,
    }),
  }

  return {
    ...summary,
    report: createGateReport(summary),
  }
}
