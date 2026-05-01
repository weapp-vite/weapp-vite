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
import { computed, inject, onBeforeUnmount, onMounted, provide, shallowRef } from 'vue'
import { sampleRuntimeEvents } from '../constants/shell'
import {
  createAnalyzeHistorySnapshot,
  isSameAnalyzeResult,
  normalizeHistorySnapshots,
  readStoredAnalyzeHistory,
  resolveInitialPreviousResult,
  writeStoredAnalyzeHistory,
} from '../utils/analyzeHistory'
import { normalizeRuntimeEvents, summarizeRuntimeEventsBySource } from '../utils/runtimeEvents'
import {
  createRuntimeEventSummary,
  createWorkspaceActivityItems,
  createWorkspaceCommands,
  createWorkspaceDiagnostics,
  createWorkspaceSignals,
  createWorkspaceSummaryStats,
  formatWorkspaceCurrentTime,
} from '../utils/workspaceSummaries'

interface DashboardWorkspaceContext {
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

const dashboardWorkspaceKey: InjectionKey<DashboardWorkspaceContext> = Symbol('dashboard-workspace')

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
  const runtimeEvents = shallowRef<DashboardRuntimeEvent[]>(window.__WEAPP_VITE_DASHBOARD_EVENTS__?.length
    ? normalizeRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
    : normalizeRuntimeEvents(sampleRuntimeEvents))
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

  const statusLabel = computed(() => resultRef.value ? 'payload ready' : 'awaiting payload')
  const statusSummary = computed(() =>
    resultRef.value
      ? `${summary.value.packageCount} 个包 · ${summary.value.moduleCount} 个模块`
      : '尚未接收到 CLI analyze 数据',
  )
  const latestRuntimeEvent = computed(() => runtimeEvents.value[0] ?? null)
  const baselineSnapshot = computed(() =>
    historySnapshots.value.find(snapshot => snapshot.id === baselineSnapshotId.value) ?? null,
  )
  const comparisonResultRef = computed(() =>
    comparisonMode.value === 'baseline'
      ? baselineSnapshot.value?.result ?? previousResultRef.value
      : previousResultRef.value,
  )

  const eventSummary = computed<DashboardLabelValueItem[]>(() => createRuntimeEventSummary(runtimeEvents.value))

  const runtimeSourceSummary = computed<DashboardRuntimeSourceSummary[]>(() =>
    summarizeRuntimeEventsBySource(runtimeEvents.value),
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

  const pushRuntimeEvents = (payload: DashboardRuntimeEvent[] | null | undefined) => {
    const normalizedPayload = normalizeRuntimeEvents(payload)

    if (normalizedPayload.length === 0) {
      return
    }

    const nextEvents = [...normalizedPayload, ...runtimeEvents.value]
    const deduped = new Map<string, DashboardRuntimeEvent>()

    for (const event of nextEvents) {
      deduped.set(event.id, event)
    }

    runtimeEvents.value = [...deduped.values()].slice(0, 24)
    window.__WEAPP_VITE_DASHBOARD_EVENTS__ = [...runtimeEvents.value]
  }

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

  const handleRuntimeEvent = (event: Event) => {
    const payload = event instanceof CustomEvent
      ? event.detail
      : null
    const events = Array.isArray(payload) ? payload : payload ? [payload] : null

    pushRuntimeEvents(events)
  }

  onMounted(() => {
    window.addEventListener('weapp-analyze:update', syncFromWindow)
    window.addEventListener('weapp-dashboard:event', handleRuntimeEvent)
    syncFromWindow()
    pushRuntimeEvents(window.__WEAPP_VITE_DASHBOARD_EVENTS__)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('weapp-analyze:update', syncFromWindow)
    window.removeEventListener('weapp-dashboard:event', handleRuntimeEvent)
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
