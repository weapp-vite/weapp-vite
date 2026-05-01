import type { AnalyzeActionCenterItem, AnalyzeWorkQueueItem, DashboardMetricItem, DashboardTab } from '../types'

export type PrReviewChecklistStatus = 'ready' | 'review' | 'blocked'
export type PrReviewChecklistLaneKey = 'blockers' | 'verification' | 'followups'

export interface PrReviewChecklistItem {
  id: string
  title: string
  detail: string
  checked: boolean
  tone: AnalyzeActionCenterItem['tone']
  tab: DashboardTab
  actionKey?: string
  workQueueItemId?: string
}

export interface PrReviewChecklistLane {
  key: PrReviewChecklistLaneKey
  title: string
  description: string
  items: PrReviewChecklistItem[]
  emptyText: string
}

export interface PrReviewChecklistSummary {
  status: PrReviewChecklistStatus
  label: string
  headline: string
  description: string
  metrics: DashboardMetricItem[]
  lanes: PrReviewChecklistLane[]
  report: string
}

function getStatusLabel(status: PrReviewChecklistStatus) {
  if (status === 'blocked') {
    return 'Blocked'
  }
  if (status === 'review') {
    return 'Review'
  }
  return 'Ready'
}

function getHeadline(status: PrReviewChecklistStatus) {
  if (status === 'blocked') {
    return 'PR 合并前仍有阻断项'
  }
  if (status === 'review') {
    return '建议完成复核后再合并'
  }
  return '当前清单未发现发布风险'
}

function createActionChecklistItem(action: AnalyzeActionCenterItem): PrReviewChecklistItem {
  return {
    id: `action:${action.key}`,
    title: action.title,
    detail: action.value ? `${action.meta} · ${action.value}` : action.meta,
    checked: action.tone === 'success',
    tone: action.tone,
    tab: action.tab,
    actionKey: action.key,
  }
}

function createWorkQueueChecklistItem(item: AnalyzeWorkQueueItem): PrReviewChecklistItem {
  return {
    id: `queue:${item.id}`,
    title: item.title,
    detail: item.value ? `${item.meta} · ${item.value}` : item.meta,
    checked: Boolean(item.completedAt),
    tone: item.tone,
    tab: item.tab,
    workQueueItemId: item.id,
  }
}

function createLaneReport(lane: PrReviewChecklistLane) {
  if (lane.items.length === 0) {
    return [`- [x] ${lane.emptyText}`]
  }
  return lane.items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.title}：${item.detail}`)
}

function createReport(summary: Omit<PrReviewChecklistSummary, 'report'>) {
  return [
    '## PR 风险清单',
    '',
    `状态：${summary.label}`,
    summary.headline,
    '',
    ...summary.metrics.map(item => `- ${item.label}：${item.value}`),
    '',
    ...summary.lanes.flatMap(lane => [
      `### ${lane.title}`,
      '',
      ...createLaneReport(lane),
      '',
    ]),
  ].join('\n')
}

export function createPrReviewChecklistSummary(options: {
  actionItems: AnalyzeActionCenterItem[]
  workQueueItems: AnalyzeWorkQueueItem[]
}): PrReviewChecklistSummary {
  const criticalActions = options.actionItems.filter(item => item.tone === 'critical')
  const warningActions = options.actionItems.filter(item => item.tone === 'warning')
  const openWorkQueueItems = options.workQueueItems.filter(item => !item.completedAt)
  const completedWorkQueueItems = options.workQueueItems.filter(item => item.completedAt)
  const queuedTargetKeys = new Set(options.workQueueItems.map(item => item.targetKey))
  const followupActions = options.actionItems
    .filter(item => item.tone !== 'critical' && item.tone !== 'success' && !queuedTargetKeys.has(item.key))
    .slice(0, 4)

  const status: PrReviewChecklistStatus = criticalActions.length > 0
    ? 'blocked'
    : warningActions.length > 0 || openWorkQueueItems.length > 0
      ? 'review'
      : 'ready'
  const lanes: PrReviewChecklistLane[] = [
    {
      key: 'blockers',
      title: '合并前阻断',
      description: '必须先处理的预算、增长或产物异常。',
      items: criticalActions.slice(0, 5).map(createActionChecklistItem),
      emptyText: '没有阻断项。',
    },
    {
      key: 'verification',
      title: '评审复核',
      description: '需要 reviewer 主动确认的高风险变化。',
      items: warningActions.slice(0, 6).map(createActionChecklistItem),
      emptyText: '没有需要额外复核的风险。',
    },
    {
      key: 'followups',
      title: '后续跟进',
      description: '来自处理清单和剩余建议动作的后续事项。',
      items: [
        ...openWorkQueueItems.slice(0, 4).map(createWorkQueueChecklistItem),
        ...followupActions.map(createActionChecklistItem),
      ].slice(0, 6),
      emptyText: completedWorkQueueItems.length > 0 ? '处理清单已完成。' : '没有待跟进事项。',
    },
  ]
  const summary = {
    status,
    label: getStatusLabel(status),
    headline: getHeadline(status),
    description: `${options.actionItems.length} 个分析动作 · ${openWorkQueueItems.length} 个待处理清单`,
    metrics: [
      { label: '阻断项', value: criticalActions.length },
      { label: '复核项', value: warningActions.length },
      { label: '待处理', value: openWorkQueueItems.length },
      { label: '已完成', value: completedWorkQueueItems.length },
    ],
    lanes,
  }

  return {
    ...summary,
    report: createReport(summary),
  }
}
