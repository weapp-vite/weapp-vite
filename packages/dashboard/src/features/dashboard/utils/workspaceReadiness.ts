import type { AnalyzeSubpackagesResult, DashboardMetricItem, DashboardRuntimeEvent, WorkspaceDiagnosticItem } from '../types'
import { formatBytes, formatRuntimeEventLevel } from './format'

export type WorkspaceReadinessStatus = 'pending' | 'attention' | 'ready'

export interface WorkspaceReadinessAction {
  id: string
  title: string
  detail: string
  to: string
  label: string
}

export interface WorkspaceReadinessSummary {
  status: WorkspaceReadinessStatus
  statusLabel: string
  statusDetail: string
  metrics: DashboardMetricItem[]
  actions: WorkspaceReadinessAction[]
  latestEvent?: {
    title: string
    detail: string
    levelLabel: string
    timestamp: string
  }
  report: string
}

function getResultTotalBytes(result: AnalyzeSubpackagesResult | null) {
  return result?.packages
    .flatMap(pkg => pkg.files)
    .reduce((sum, file) => sum + (file.size ?? 0), 0) ?? 0
}

function getDuplicateModuleCount(result: AnalyzeSubpackagesResult | null) {
  return result?.modules.filter(module => module.packages.length > 1).length ?? 0
}

function getWarningEventCount(events: DashboardRuntimeEvent[]) {
  return events.filter(event => event.level === 'warning').length
}

function getErrorEventCount(events: DashboardRuntimeEvent[]) {
  return events.filter(event => event.level === 'error').length
}

function getStatus(options: {
  result: AnalyzeSubpackagesResult | null
  errorCount: number
  warningCount: number
}): WorkspaceReadinessStatus {
  if (!options.result) {
    return 'pending'
  }
  if (options.errorCount > 0 || options.warningCount > 0) {
    return 'attention'
  }
  return 'ready'
}

function getStatusLabel(status: WorkspaceReadinessStatus) {
  if (status === 'pending') {
    return '等待分析数据'
  }
  if (status === 'attention') {
    return '需要跟进'
  }
  return '可以继续分析'
}

function createStatusDetail(options: {
  status: WorkspaceReadinessStatus
  packageCount: number
  moduleCount: number
  errorCount: number
  warningCount: number
}) {
  if (options.status === 'pending') {
    return '当前还没有 CLI 注入的 analyze payload，可以先运行分析命令。'
  }
  if (options.status === 'attention') {
    return `已载入 ${options.packageCount} 个包，事件流包含 ${options.errorCount} 个错误和 ${options.warningCount} 个警告。`
  }
  return `已载入 ${options.packageCount} 个包与 ${options.moduleCount} 个模块，当前事件流没有错误或警告。`
}

function createActions(status: WorkspaceReadinessStatus): WorkspaceReadinessAction[] {
  if (status === 'pending') {
    return [
      {
        id: 'run-analyze',
        title: '先运行分析命令',
        detail: '从右侧命令中心复制 analyze 命令，获取真实包体数据。',
        to: '/',
        label: '查看命令',
      },
      {
        id: 'inspect-activity',
        title: '检查事件链路',
        detail: '确认 CLI 注入和 runtime event 是否按预期进入 dashboard。',
        to: '/activity',
        label: '活动流',
      },
    ]
  }

  if (status === 'attention') {
    return [
      {
        id: 'open-activity',
        title: '先处理异常事件',
        detail: '进入活动流查看错误、警告和慢事件摘要。',
        to: '/activity',
        label: '看事件',
      },
      {
        id: 'open-review',
        title: '整理 PR 风险',
        detail: '进入评审页复制风险清单，和代码改动一起处理。',
        to: '/analyze?tab=review',
        label: '评审清单',
      },
    ]
  }

  return [
    {
      id: 'open-overview',
      title: '查看全局摘要',
      detail: '进入分析视图核对包体、预算和历史趋势。',
      to: '/analyze',
      label: '分析视图',
    },
    {
      id: 'open-source',
      title: '对比源码产物',
      detail: '继续检查源码模块与最终产物之间的体积差异。',
      to: '/analyze?tab=source',
      label: '源码对比',
    },
  ]
}

function createLatestEvent(events: DashboardRuntimeEvent[]) {
  const event = events[0]
  if (!event) {
    return undefined
  }

  return {
    title: event.title,
    detail: event.detail,
    levelLabel: formatRuntimeEventLevel(event.level),
    timestamp: event.timestamp,
  }
}

function createReport(summary: Omit<WorkspaceReadinessSummary, 'report'>) {
  return [
    '# dashboard 工作区摘要',
    '',
    `状态：${summary.statusLabel}`,
    `说明：${summary.statusDetail}`,
    '',
    '## 指标',
    ...summary.metrics.map(metric => `- ${metric.label}：${metric.value}`),
    '',
    '## 建议动作',
    ...summary.actions.map(action => `- ${action.title}：${action.detail}`),
    '',
    '## 最新事件',
    summary.latestEvent
      ? `- [${summary.latestEvent.levelLabel}] ${summary.latestEvent.title}（${summary.latestEvent.timestamp}）：${summary.latestEvent.detail}`
      : '- 暂无运行事件',
    '',
  ].join('\n')
}

export function createWorkspaceReadinessSummary(options: {
  result: AnalyzeSubpackagesResult | null
  runtimeEvents: DashboardRuntimeEvent[]
  diagnostics: WorkspaceDiagnosticItem[]
  updateCount: number
  lastUpdatedAt: string
}): WorkspaceReadinessSummary {
  const packageCount = options.result?.packages.length ?? 0
  const moduleCount = options.result?.modules.length ?? 0
  const duplicateCount = getDuplicateModuleCount(options.result)
  const totalBytes = getResultTotalBytes(options.result)
  const warningCount = getWarningEventCount(options.runtimeEvents)
  const errorCount = getErrorEventCount(options.runtimeEvents)
  const status = getStatus({
    result: options.result,
    errorCount,
    warningCount,
  })

  const summary = {
    status,
    statusLabel: getStatusLabel(status),
    statusDetail: createStatusDetail({
      status,
      packageCount,
      moduleCount,
      errorCount,
      warningCount,
    }),
    metrics: [
      { label: '包数量', value: packageCount },
      { label: '模块数', value: moduleCount },
      { label: '重复模块', value: duplicateCount },
      { label: '产物体积', value: options.result ? formatBytes(totalBytes) : '未载入' },
      { label: '同步次数', value: options.updateCount },
      { label: '诊断项', value: options.diagnostics.length },
    ],
    actions: createActions(status),
    latestEvent: createLatestEvent(options.runtimeEvents),
  }

  return {
    ...summary,
    report: createReport(summary),
  }
}
