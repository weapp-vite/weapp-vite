import type {
  AnalyzeSubpackagesResult,
  DashboardLabelValueItem,
  DashboardRuntimeEvent,
  WorkspaceActivityItem,
  WorkspaceCommandItem,
  WorkspaceDiagnosticItem,
  WorkspaceSignalItem,
} from '../types'
import { activityFeed, diagnosticsQueue, quickCommands } from '../constants/shell'
import { formatBytes, formatDuration } from './format'

interface WorkspaceSummaryStats {
  packageCount: number
  moduleCount: number
  duplicateCount: number
  totalBytes: number
}

function createLabelValueItem(label: string, value: string): DashboardLabelValueItem {
  return { label, value }
}

export function formatWorkspaceCurrentTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export function createWorkspaceSummaryStats(result: AnalyzeSubpackagesResult | null): WorkspaceSummaryStats {
  if (!result) {
    return {
      packageCount: 0,
      moduleCount: 0,
      duplicateCount: 0,
      totalBytes: 0,
    }
  }

  const files = result.packages.flatMap(pkg => pkg.files)

  return {
    packageCount: result.packages.length,
    moduleCount: result.modules.length,
    duplicateCount: result.modules.filter(mod => mod.packages.length > 1).length,
    totalBytes: files.reduce((sum, file) => sum + (file.size ?? 0), 0),
  }
}

export function createRuntimeEventSummary(runtimeEvents: DashboardRuntimeEvent[]): DashboardLabelValueItem[] {
  const errorCount = runtimeEvents.filter(event => event.level === 'error').length
  const warningCount = runtimeEvents.filter(event => event.level === 'warning').length
  const commandCount = runtimeEvents.filter(event => event.kind === 'command').length
  const timedEvents = runtimeEvents.filter(event => typeof event.durationMs === 'number')
  const averageDuration = timedEvents.length > 0
    ? Math.round(timedEvents.reduce((sum, event) => sum + (event.durationMs ?? 0), 0) / timedEvents.length)
    : undefined

  return [
    createLabelValueItem('总事件数', String(runtimeEvents.length)),
    createLabelValueItem('命令事件', String(commandCount)),
    createLabelValueItem('已记录耗时', String(timedEvents.length)),
    createLabelValueItem('平均耗时', formatDuration(averageDuration)),
    createLabelValueItem('警告事件', String(warningCount)),
    createLabelValueItem('错误事件', String(errorCount)),
  ]
}

export function createWorkspaceSignals(options: {
  result: AnalyzeSubpackagesResult | null
  updateCount: number
  summary: WorkspaceSummaryStats
  runtimeEventCount: number
  latestRuntimeEvent: DashboardRuntimeEvent | null
}): WorkspaceSignalItem[] {
  return [
    {
      label: '页面骨架',
      value: '4 个',
      iconName: 'metric-ready',
    },
    {
      label: '连接状态',
      value: options.result ? '已接入 payload' : '等待注入',
      iconName: options.result ? 'status-live' : 'metric-health',
    },
    {
      label: '数据同步',
      value: `${options.updateCount} 次`,
      iconName: 'metric-latency',
    },
    {
      label: '产物体积',
      value: options.result ? formatBytes(options.summary.totalBytes) : '未载入',
      iconName: 'metric-quality',
    },
    {
      label: '运行事件',
      value: `${options.runtimeEventCount} 条`,
      iconName: options.latestRuntimeEvent?.level === 'error' ? 'metric-health' : 'metric-time',
    },
  ]
}

export function createWorkspaceCommands(options: {
  result: AnalyzeSubpackagesResult | null
  lastUpdatedAt: string
  summary: WorkspaceSummaryStats
  updateCount: number
}): WorkspaceCommandItem[] {
  if (!options.result) {
    return quickCommands
  }

  return [
    {
      label: '重新分析当前工程',
      command: 'weapp-vite analyze',
      note: `最近同步于 ${options.lastUpdatedAt}，当前可读取 ${options.summary.packageCount} 个包。`,
      category: 'analyze',
    },
    {
      label: '进入构建联调',
      command: 'weapp-vite build --ui',
      note: `当前产物总体积 ${formatBytes(options.summary.totalBytes)}，适合继续核对 chunk 结构。`,
      category: 'build',
    },
    {
      label: '观察开发态更新',
      command: 'weapp-vite dev --ui',
      note: `已记录 ${options.updateCount} 次 payload 同步，后续可继续接入更细粒度事件。`,
      category: 'dev',
    },
  ]
}

export function createWorkspaceActivityItems(options: {
  runtimeEvents: DashboardRuntimeEvent[]
  result: AnalyzeSubpackagesResult | null
  lastUpdatedAt: string
  summary: WorkspaceSummaryStats
}): WorkspaceActivityItem[] {
  const items = [...activityFeed]

  for (const event of options.runtimeEvents.slice(0, 4)) {
    items.unshift({
      time: event.timestamp,
      title: event.title,
      summary: event.detail,
      tone: event.level === 'error' || event.level === 'warning' ? 'default' : 'live',
    })
  }

  if (options.result) {
    items.unshift({
      time: options.lastUpdatedAt,
      title: 'workspace payload received',
      summary: `已收到一份真实 analyze 结果，包含 ${options.summary.packageCount} 个包和 ${options.summary.moduleCount} 个模块。`,
      tone: 'live',
    })
  }

  return items
}

export function createWorkspaceDiagnostics(options: {
  result: AnalyzeSubpackagesResult | null
  latestRuntimeEvent: DashboardRuntimeEvent | null
  summary: WorkspaceSummaryStats
}): WorkspaceDiagnosticItem[] {
  const items = [...diagnosticsQueue]

  if (options.latestRuntimeEvent) {
    items.unshift({
      label: '最新运行事件',
      detail: `${options.latestRuntimeEvent.title} · ${options.latestRuntimeEvent.detail}`,
      status: options.latestRuntimeEvent.level,
    })
  }

  if (!options.result) {
    return [
      {
        label: 'CLI 注入链路',
        detail: '尚未接收到 analyze payload，当前页面以空态方式工作。',
        status: '待接入',
      },
      ...items,
    ]
  }

  return [
    {
      label: '实时分析状态',
      detail: `已接入 payload，当前记录 ${options.summary.duplicateCount} 个跨包复用模块。`,
      status: '在线',
    },
    {
      label: '产物规模',
      detail: `总产物体积 ${formatBytes(options.summary.totalBytes)}，可继续进入分析页查看 treemap 与最大文件。`,
      status: '可分析',
    },
    ...items,
  ]
}
