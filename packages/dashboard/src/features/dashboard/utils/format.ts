import type { DashboardRuntimeEventKind, DashboardRuntimeEventLevel } from '../types'

export function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) {
    return '—'
  }

  const base = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= base && unitIndex < units.length - 1) {
    value /= base
    unitIndex++
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

export function formatPackageType(type: string) {
  switch (type) {
    case 'main':
      return '主包'
    case 'subPackage':
      return '分包'
    case 'independent':
      return '独立分包'
    case 'virtual':
      return '虚拟包'
    default:
      return type
  }
}

export function formatBuildOrigin(origin: string) {
  return origin === 'independent' ? '独立构建' : '主构建'
}

export function formatSourceType(type: string) {
  switch (type) {
    case 'src':
      return '业务源码'
    case 'workspace':
      return '工作区包'
    case 'plugin':
      return '插件'
    case 'node_modules':
      return '依赖'
    default:
      return type
  }
}

export function formatRuntimeEventKind(kind: DashboardRuntimeEventKind) {
  switch (kind) {
    case 'command':
      return '命令'
    case 'build':
      return '构建'
    case 'diagnostic':
      return '诊断'
    case 'hmr':
      return 'HMR'
    case 'system':
      return '系统'
    default:
      return kind
  }
}

export function formatRuntimeEventLevel(level: DashboardRuntimeEventLevel) {
  switch (level) {
    case 'info':
      return '信息'
    case 'success':
      return '成功'
    case 'warning':
      return '警告'
    case 'error':
      return '错误'
    default:
      return level
  }
}

export function formatRuntimeEventSource(source?: string) {
  return source ?? 'dashboard'
}

export function getRuntimeEventBadgeTone(level: DashboardRuntimeEventLevel) {
  return level
}

export function getRuntimeSourceBadgeTone(errorCount: number) {
  return errorCount > 0 ? 'error' : 'info'
}

export function formatDuration(durationMs?: number) {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs < 0) {
    return '未记录'
  }

  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 1 : 2)} s`
  }

  return `${durationMs} ms`
}

export function formatRuntimeEventMeta(options: {
  kind: DashboardRuntimeEventKind
  source?: string
  timestamp: string
  durationMs?: number
}) {
  const parts = [
    formatRuntimeEventKind(options.kind),
    formatRuntimeEventSource(options.source),
    options.timestamp,
  ]

  if (typeof options.durationMs === 'number' && Number.isFinite(options.durationMs) && options.durationMs >= 0) {
    parts.push(formatDuration(options.durationMs))
  }

  return parts.join(' · ')
}
