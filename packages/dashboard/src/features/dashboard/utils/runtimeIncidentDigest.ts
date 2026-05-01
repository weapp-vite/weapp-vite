import type { DashboardMetricItem, DashboardRuntimeEvent, DashboardRuntimeEventLevel } from '../types'
import { formatDuration, formatRuntimeEventKind, formatRuntimeEventLevel } from './format'

export type RuntimeIncidentDigestStatus = 'healthy' | 'warning' | 'critical'

export interface RuntimeIncidentItem {
  id: string
  title: string
  detail: string
  level: DashboardRuntimeEventLevel
  levelLabel: string
  kindLabel: string
  source: string
  timestamp: string
  duration: string
  reason: string
}

export interface RuntimeIncidentDigest {
  status: RuntimeIncidentDigestStatus
  statusLabel: string
  statusDetail: string
  metrics: DashboardMetricItem[]
  affectedSources: string[]
  incidents: RuntimeIncidentItem[]
  report: string
}

const DEFAULT_SLOW_EVENT_THRESHOLD_MS = 1000
const MAX_INCIDENT_COUNT = 5

const severityRank = {
  error: 4,
  warning: 3,
  success: 2,
  info: 1,
} satisfies Record<DashboardRuntimeEventLevel, number>

function getEventTime(event: DashboardRuntimeEvent) {
  const time = Date.parse(event.timestamp)
  return Number.isFinite(time) ? time : 0
}

function isSlowEvent(event: DashboardRuntimeEvent, slowEventThresholdMs: number) {
  return typeof event.durationMs === 'number' && event.durationMs >= slowEventThresholdMs
}

function isIncidentEvent(event: DashboardRuntimeEvent, slowEventThresholdMs: number) {
  return event.level === 'error'
    || event.level === 'warning'
    || isSlowEvent(event, slowEventThresholdMs)
}

function getIncidentReasons(event: DashboardRuntimeEvent, slowEventThresholdMs: number) {
  const reasons: string[] = []

  if (event.level === 'error') {
    reasons.push('错误事件')
  }
  else if (event.level === 'warning') {
    reasons.push('警告事件')
  }

  if (isSlowEvent(event, slowEventThresholdMs)) {
    reasons.push(`耗时 ${formatDuration(event.durationMs)}`)
  }

  return reasons.join(' · ') || '需要关注'
}

function createRuntimeIncidentItem(event: DashboardRuntimeEvent, slowEventThresholdMs: number): RuntimeIncidentItem {
  return {
    id: event.id,
    title: event.title,
    detail: event.detail,
    level: event.level,
    levelLabel: formatRuntimeEventLevel(event.level),
    kindLabel: formatRuntimeEventKind(event.kind),
    source: event.source ?? 'dashboard',
    timestamp: event.timestamp,
    duration: formatDuration(event.durationMs),
    reason: getIncidentReasons(event, slowEventThresholdMs),
  }
}

function getStatus(errorCount: number, warningCount: number, slowCount: number): RuntimeIncidentDigestStatus {
  if (errorCount > 0) {
    return 'critical'
  }
  if (warningCount > 0 || slowCount > 0) {
    return 'warning'
  }
  return 'healthy'
}

function getStatusLabel(status: RuntimeIncidentDigestStatus) {
  if (status === 'critical') {
    return '需要立即处理'
  }
  if (status === 'warning') {
    return '需要关注'
  }
  return '运行平稳'
}

function createStatusDetail(status: RuntimeIncidentDigestStatus, errorCount: number, warningCount: number, slowCount: number) {
  if (status === 'critical') {
    return `检测到 ${errorCount} 个错误事件，优先排查失败来源。`
  }
  if (status === 'warning') {
    return `检测到 ${warningCount} 个警告和 ${slowCount} 个慢事件，建议跟进。`
  }
  return '当前筛选范围内没有错误、警告或慢事件。'
}

function createReport(digest: Omit<RuntimeIncidentDigest, 'report'>) {
  const incidentRows = digest.incidents.length > 0
    ? digest.incidents.map(item =>
        `- [${item.levelLabel}] ${item.title}（${item.source} · ${item.kindLabel} · ${item.timestamp} · ${item.duration}）：${item.detail}`,
      )
    : ['- 当前筛选范围内没有需要处理的事件。']

  return [
    '# dashboard 运行时事故摘要',
    '',
    `状态：${digest.statusLabel}`,
    `说明：${digest.statusDetail}`,
    '',
    '## 指标',
    ...digest.metrics.map(item => `- ${item.label}：${item.value}`),
    '',
    '## 影响来源',
    digest.affectedSources.length > 0 ? digest.affectedSources.map(source => `- ${source}`).join('\n') : '- 无',
    '',
    '## 优先处理',
    ...incidentRows,
    '',
  ].join('\n')
}

export function createRuntimeIncidentDigest(
  events: DashboardRuntimeEvent[],
  options: { slowEventThresholdMs?: number } = {},
): RuntimeIncidentDigest {
  const slowEventThresholdMs = options.slowEventThresholdMs ?? DEFAULT_SLOW_EVENT_THRESHOLD_MS
  const errorCount = events.filter(event => event.level === 'error').length
  const warningCount = events.filter(event => event.level === 'warning').length
  const slowCount = events.filter(event => isSlowEvent(event, slowEventThresholdMs)).length
  const incidentEvents = events.filter(event => isIncidentEvent(event, slowEventThresholdMs))
  const affectedSources = [...new Set(incidentEvents.map(event => event.source ?? 'dashboard'))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  const status = getStatus(errorCount, warningCount, slowCount)
  const incidents = incidentEvents
    .toSorted((left, right) =>
      severityRank[right.level] - severityRank[left.level]
      || (right.durationMs ?? -1) - (left.durationMs ?? -1)
      || getEventTime(right) - getEventTime(left),
    )
    .slice(0, MAX_INCIDENT_COUNT)
    .map(event => createRuntimeIncidentItem(event, slowEventThresholdMs))

  const digest = {
    status,
    statusLabel: getStatusLabel(status),
    statusDetail: createStatusDetail(status, errorCount, warningCount, slowCount),
    metrics: [
      { label: '事件总数', value: events.length },
      { label: '错误', value: errorCount },
      { label: '警告', value: warningCount },
      { label: '慢事件', value: slowCount },
      { label: '影响来源', value: affectedSources.length },
    ],
    affectedSources,
    incidents,
  }

  return {
    ...digest,
    report: createReport(digest),
  }
}
