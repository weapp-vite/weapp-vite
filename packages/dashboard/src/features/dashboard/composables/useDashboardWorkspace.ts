import type {
  AnalyzeComparisonMode,
  AnalyzeHistorySnapshot,
  AnalyzeSubpackagesResult,
  DashboardRuntimeEvent,
  WorkspaceActivityItem,
  WorkspaceCommandItem,
  WorkspaceDiagnosticItem,
  WorkspaceSignalItem,
} from '../types'
import type { DashboardWorkspaceContext } from './dashboardWorkspaceContext'
import { computed, inject, onBeforeUnmount, onMounted, provide, shallowRef } from 'vue'
import {
  createAnalyzeHistorySnapshot,
  isSameAnalyzeResult,
  normalizeHistorySnapshots,
  readStoredAnalyzeHistory,
  resolveInitialPreviousResult,
  writeStoredAnalyzeHistory,
} from '../utils/analyzeHistory'
import {
  createWorkspaceActivityItems,
  createWorkspaceCommands,
  createWorkspaceDiagnostics,
  createWorkspaceSignals,
  createWorkspaceSummaryStats,
  formatWorkspaceCurrentTime,
} from '../utils/workspaceSummaries'
import { dashboardWorkspaceKey } from './dashboardWorkspaceContext'
import {
  createInitialDashboardRuntimeEvents,
  useDashboardRuntimeEventStream,
} from './useDashboardRuntimeEventStream'

export function createDashboardWorkspace(): DashboardWorkspaceContext {
  const initialPayload = window.__WEAPP_VITE_ANALYZE_RESULT__ ?? null
  const initialPreviousPayload = window.__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__ ?? null
  const storedHistory = readStoredAnalyzeHistory()
  const resultRef = shallowRef<AnalyzeSubpackagesResult | null>(initialPayload)
  const previousResultRef = shallowRef<AnalyzeSubpackagesResult | null>(
    resolveInitialPreviousResult(initialPayload, initialPreviousPayload, storedHistory),
  )
  const historySnapshots = shallowRef<AnalyzeHistorySnapshot[]>(
    storedHistory ? normalizeHistorySnapshots(storedHistory) : initialPayload ? [createAnalyzeHistorySnapshot(initialPayload)] : [],
  )
  const baselineSnapshotId = shallowRef<string | null>(
    storedHistory?.baselineSnapshotId && historySnapshots.value.some(snapshot => snapshot.id === storedHistory.baselineSnapshotId)
      ? storedHistory.baselineSnapshotId
      : null,
  )
  const comparisonMode = shallowRef<AnalyzeComparisonMode>(
    storedHistory?.comparisonMode === 'baseline' && baselineSnapshotId.value ? 'baseline' : 'previous',
  )
  const runtimeEvents = shallowRef<DashboardRuntimeEvent[]>(createInitialDashboardRuntimeEvents())
  const updateCount = shallowRef(0)
  const lastUpdatedAt = shallowRef(resultRef.value ? formatWorkspaceCurrentTime() : '—')

  if (initialPayload) {
    writeStoredAnalyzeHistory({
      current: initialPayload,
      previous: previousResultRef.value,
      snapshots: historySnapshots.value,
      baselineSnapshotId: baselineSnapshotId.value,
      comparisonMode: comparisonMode.value,
    })
  }

  const summary = computed(() => createWorkspaceSummaryStats(resultRef.value))
  const {
    eventSummary,
    latestRuntimeEvent,
    runtimeSourceSummary,
  } = useDashboardRuntimeEventStream(runtimeEvents)

  const statusLabel = computed(() => resultRef.value ? 'payload ready' : 'awaiting payload')
  const statusSummary = computed(() =>
    resultRef.value
      ? `${summary.value.packageCount} 个包 · ${summary.value.moduleCount} 个模块`
      : '尚未接收到 CLI analyze 数据',
  )
  const baselineSnapshot = computed(() =>
    historySnapshots.value.find(snapshot => snapshot.id === baselineSnapshotId.value) ?? null,
  )
  const comparisonResultRef = computed(() =>
    comparisonMode.value === 'baseline'
      ? baselineSnapshot.value?.result ?? previousResultRef.value
      : previousResultRef.value,
  )

  const signals = computed<WorkspaceSignalItem[]>(() => createWorkspaceSignals({
    result: resultRef.value,
    updateCount: updateCount.value,
    summary: summary.value,
    runtimeEventCount: runtimeEvents.value.length,
    latestRuntimeEvent: latestRuntimeEvent.value,
  }))

  const commandItems = computed<WorkspaceCommandItem[]>(() => createWorkspaceCommands({
    result: resultRef.value,
    lastUpdatedAt: lastUpdatedAt.value,
    summary: summary.value,
    updateCount: updateCount.value,
  }))

  const activityItems = computed<WorkspaceActivityItem[]>(() => createWorkspaceActivityItems({
    runtimeEvents: runtimeEvents.value,
    result: resultRef.value,
    lastUpdatedAt: lastUpdatedAt.value,
    summary: summary.value,
  }))

  const diagnostics = computed<WorkspaceDiagnosticItem[]>(() => createWorkspaceDiagnostics({
    result: resultRef.value,
    latestRuntimeEvent: latestRuntimeEvent.value,
    summary: summary.value,
  }))

  const syncFromWindow = () => {
    const incoming = window.__WEAPP_VITE_ANALYZE_RESULT__
    if (!incoming) {
      return
    }

    const previousFromWindow = window.__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__ ?? null
    const stored = readStoredAnalyzeHistory()
    let previousResult = stored?.previous ?? previousResultRef.value
    if (stored?.current && !isSameAnalyzeResult(incoming, stored.current)) {
      previousResult = stored.current
    }
    if (resultRef.value && !isSameAnalyzeResult(incoming, resultRef.value)) {
      previousResult = resultRef.value
    }
    if (previousFromWindow && !isSameAnalyzeResult(incoming, previousFromWindow)) {
      previousResult = previousFromWindow
    }

    previousResultRef.value = isSameAnalyzeResult(incoming, previousResult)
      ? null
      : previousResult
    resultRef.value = incoming
    const incomingSnapshot = createAnalyzeHistorySnapshot(incoming)
    const nextSnapshots = normalizeHistorySnapshots({
      current: incoming,
      previous: previousResultRef.value,
      snapshots: [incomingSnapshot, ...historySnapshots.value],
    })
    historySnapshots.value = nextSnapshots
    if (baselineSnapshotId.value && !nextSnapshots.some(snapshot => snapshot.id === baselineSnapshotId.value)) {
      baselineSnapshotId.value = nextSnapshots.at(-1)?.id ?? null
    }
    if (comparisonMode.value === 'baseline' && !baselineSnapshotId.value) {
      comparisonMode.value = 'previous'
    }
    writeStoredAnalyzeHistory({
      current: incoming,
      previous: previousResultRef.value,
      snapshots: historySnapshots.value,
      baselineSnapshotId: baselineSnapshotId.value,
      comparisonMode: comparisonMode.value,
    })
    updateCount.value += 1
    lastUpdatedAt.value = formatWorkspaceCurrentTime()
  }

  const persistHistoryPreferences = () => {
    if (!resultRef.value) {
      return
    }
    writeStoredAnalyzeHistory({
      current: resultRef.value,
      previous: previousResultRef.value,
      snapshots: historySnapshots.value,
      baselineSnapshotId: baselineSnapshotId.value,
      comparisonMode: comparisonMode.value,
    })
  }

  const setBaselineSnapshot = (id: string) => {
    if (!historySnapshots.value.some(snapshot => snapshot.id === id)) {
      return
    }
    baselineSnapshotId.value = id
    comparisonMode.value = 'baseline'
    persistHistoryPreferences()
  }

  const setComparisonMode = (mode: AnalyzeComparisonMode) => {
    comparisonMode.value = mode === 'baseline' && !baselineSnapshotId.value ? 'previous' : mode
    persistHistoryPreferences()
  }

  onMounted(() => {
    window.addEventListener('weapp-analyze:update', syncFromWindow)
    syncFromWindow()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('weapp-analyze:update', syncFromWindow)
  })

  return {
    resultRef,
    previousResultRef,
    comparisonResultRef,
    historySnapshots,
    baselineSnapshotId,
    comparisonMode,
    updateCount,
    lastUpdatedAt,
    statusLabel,
    statusSummary,
    commandItems,
    activityItems,
    diagnostics,
    signals,
    runtimeEvents,
    latestRuntimeEvent,
    eventSummary,
    runtimeSourceSummary,
    setBaselineSnapshot,
    setComparisonMode,
  }
}

export function provideDashboardWorkspace(context: DashboardWorkspaceContext) {
  provide(dashboardWorkspaceKey, context)
}

export function useDashboardWorkspace() {
  const context = inject(dashboardWorkspaceKey, null)

  if (!context) {
    throw new Error('[dashboard] workspace context is not available')
  }

  return context
}
