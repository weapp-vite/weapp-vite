import type { LargestFileEntry, PackageBudgetWarning } from './analyze'
import type { DashboardTab } from './base'
import type { TreemapModuleNodeMeta, TreemapPackageNodeMeta } from './treemap'

export type AnalyzeActionCenterTone = 'critical' | 'warning' | 'info' | 'success'
export type AnalyzeActionCenterKind = 'budget' | 'increment' | 'duplicate' | 'file'

export interface AnalyzeActionCenterItem {
  key: string
  kind: AnalyzeActionCenterKind
  title: string
  meta: string
  value?: string
  tone: AnalyzeActionCenterTone
  tab: DashboardTab
  priority: number
  warning?: PackageBudgetWarning
  file?: LargestFileEntry
  moduleMeta?: TreemapModuleNodeMeta
}

export type AnalyzeWorkQueueTargetKind = 'action' | 'file' | 'budget'

export interface AnalyzeWorkQueueItem {
  id: string
  targetKind: AnalyzeWorkQueueTargetKind
  targetKey: string
  title: string
  meta: string
  value?: string
  tone: AnalyzeActionCenterTone
  tab: DashboardTab
  createdAt: string
  completedAt?: string
}

export type AnalyzeCommandPaletteKind = 'action' | 'budget' | 'package' | 'file' | 'module' | 'increment'

export interface AnalyzeCommandPaletteItem {
  key: string
  kind: AnalyzeCommandPaletteKind
  title: string
  meta: string
  value?: string
  keywords: string
  tab: DashboardTab
  action?: AnalyzeActionCenterItem
  warning?: PackageBudgetWarning
  file?: LargestFileEntry
  packageMeta?: TreemapPackageNodeMeta
  moduleMeta?: TreemapModuleNodeMeta
}
