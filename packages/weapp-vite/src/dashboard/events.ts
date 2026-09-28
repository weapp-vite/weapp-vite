type DashboardRuntimeEventKind = 'command' | 'build' | 'diagnostic' | 'hmr' | 'system'
type DashboardRuntimeEventLevel = 'info' | 'success' | 'warning' | 'error'

export interface DashboardRuntimeEvent extends DashboardRuntimeEventInput {
  id: string
  timestamp: string
  source: string
}

export interface DashboardRuntimeEventProfile {
  timestamp?: string
  totalMs?: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
  buildCoreMs?: number
  buildStartMs?: number
  pluginResolveMs?: number
  transformMs?: number
  snapshotResolveMs?: number
  snapshotBuildMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  resolveCount?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

export interface DashboardRuntimeEventInput {
  kind: DashboardRuntimeEventKind
  level: DashboardRuntimeEventLevel
  title: string
  detail: string
  source?: string
  durationMs?: number
  tags?: string[]
  profile?: DashboardRuntimeEventProfile
}

export function createDashboardRuntimeEvent(input: DashboardRuntimeEventInput): DashboardRuntimeEvent {
  return {
    id: `dashboard:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    level: input.level,
    title: input.title,
    detail: input.detail,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    source: input.source ?? 'weapp-vite',
    durationMs: input.durationMs,
    tags: input.tags,
    profile: input.profile,
  }
}

export function prependDashboardRuntimeEvents(
  current: DashboardRuntimeEvent[],
  inputs: DashboardRuntimeEventInput[],
): DashboardRuntimeEvent[] {
  return [...inputs.map(createDashboardRuntimeEvent), ...current].slice(0, 24)
}
