import type { DashboardIconName } from './base'

export interface DashboardNavItem {
  to: string
  label: string
  caption: string
  iconName: DashboardIconName
  children?: Array<Omit<DashboardNavItem, 'children'>>
}

export interface WorkspaceCommandItem {
  label: string
  command: string
  note: string
  category: WorkspaceCommandCategory
}

export type WorkspaceCommandCategory = 'dev' | 'build' | 'analyze'

export interface WorkspaceActivityItem {
  time: string
  title: string
  summary: string
  tone: 'live' | 'default'
}

export interface WorkspaceDiagnosticItem {
  label: string
  detail: string
  status: string
}

export interface WorkspaceSignalItem {
  label: string
  value: string
  iconName: DashboardIconName
}

export type DashboardRuntimeEventKind = 'command' | 'build' | 'diagnostic' | 'hmr' | 'system'
export type DashboardRuntimeEventLevel = 'info' | 'success' | 'warning' | 'error'
export type ActivityEventSortMode = 'time' | 'duration' | 'severity' | 'source'

export interface DashboardRuntimeEvent {
  id: string
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  timestamp: string
  source?: string
  durationMs?: number
  tags?: string[]
}

export interface DashboardRuntimeSourceSummary {
  source: string
  count: number
  errorCount: number
  latestTimestamp: string
  averageDurationMs?: number
}

export interface DashboardRuntimeSourceCardItem extends DashboardRuntimeSourceSummary {
  averageDuration: string
}
