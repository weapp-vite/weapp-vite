import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'
import type {
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeSubpackagesResult,
  DashboardLabelValueItem,
  DashboardRuntimeEvent,
  DashboardRuntimeSourceSummary,
  WorkspaceActivityItem,
  WorkspaceCommandItem,
  WorkspaceDiagnosticItem,
  WorkspaceSignalItem,
} from '../types'

export interface DashboardWorkspaceContext {
  resultRef: ShallowRef<AnalyzeSubpackagesResult | null>
  previousResultRef: ShallowRef<AnalyzeSubpackagesResult | null>
  comparisonResultRef: ComputedRef<AnalyzeSubpackagesResult | null>
  historySnapshots: Ref<AnalyzeHistorySnapshot[]>
  baselineSnapshotId: Ref<string | null>
  comparisonMode: Ref<AnalyzeComparisonMode>
  updateCount: Ref<number>
  lastUpdatedAt: Ref<string>
  statusLabel: ComputedRef<string>
  statusSummary: ComputedRef<string>
  commandItems: ComputedRef<WorkspaceCommandItem[]>
  activityItems: ComputedRef<WorkspaceActivityItem[]>
  diagnostics: ComputedRef<WorkspaceDiagnosticItem[]>
  signals: ComputedRef<WorkspaceSignalItem[]>
  runtimeEvents: Ref<DashboardRuntimeEvent[]>
  latestRuntimeEvent: ComputedRef<DashboardRuntimeEvent | null>
  eventSummary: ComputedRef<DashboardLabelValueItem[]>
  runtimeSourceSummary: ComputedRef<DashboardRuntimeSourceSummary[]>
  setBaselineSnapshot: (id: string) => void
  setComparisonMode: (mode: AnalyzeComparisonMode) => void
}

export const dashboardWorkspaceKey: InjectionKey<DashboardWorkspaceContext> = Symbol('dashboard-workspace')
