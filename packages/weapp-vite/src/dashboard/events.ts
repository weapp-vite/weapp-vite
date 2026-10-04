import type { DashboardRuntimeEventsPage } from './eventsQuery'
import { DASHBOARD_RUNTIME_EVENT_CAPACITY, queryDashboardRuntimeEvents } from './eventsQuery'

type DashboardRuntimeEventKind = 'command' | 'build' | 'diagnostic' | 'hmr' | 'system'
type DashboardRuntimeEventLevel = 'info' | 'success' | 'warning' | 'error'

export interface DashboardRuntimeEvent extends DashboardRuntimeEventInput {
  id: string
  timestamp: string
  occurredAt: string
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

function createDashboardRuntimeEvent(input: DashboardRuntimeEventInput): DashboardRuntimeEvent {
  const occurredAt = new Date()
  return {
    id: `dashboard:${occurredAt.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    level: input.level,
    title: input.title,
    detail: input.detail,
    timestamp: occurredAt.toLocaleTimeString('zh-CN', { hour12: false }),
    occurredAt: occurredAt.toISOString(),
    source: input.source ?? 'weapp-vite',
    durationMs: input.durationMs,
    tags: input.tags,
    profile: input.profile,
  }
}

export interface DashboardRuntimeEventStore {
  read: () => DashboardRuntimeEvent[]
  prepend: (inputs: DashboardRuntimeEventInput[]) => void
  query: (input: unknown) => DashboardRuntimeEventsPage
  dispose: () => void
}

/** 在当前宿主会话内保留有限事件，不伪造已丢弃的历史。 */
export function createDashboardRuntimeEventStore(initialInputs: DashboardRuntimeEventInput[]): DashboardRuntimeEventStore {
  let events: DashboardRuntimeEvent[] = []
  let dropped = 0
  let disposed = false

  function assertActive() {
    if (disposed) {
      throw new Error('Dashboard 事件会话已关闭。')
    }
  }

  function prepend(inputs: DashboardRuntimeEventInput[]) {
    if (disposed || inputs.length === 0) {
      return
    }
    dropped += Math.max(0, events.length + inputs.length - DASHBOARD_RUNTIME_EVENT_CAPACITY)
    const next: DashboardRuntimeEvent[] = []
    for (let index = 0; index < Math.min(inputs.length, DASHBOARD_RUNTIME_EVENT_CAPACITY); index++) {
      next.push(createDashboardRuntimeEvent(inputs[index]!))
    }
    for (let index = 0; index < events.length && next.length < DASHBOARD_RUNTIME_EVENT_CAPACITY; index++) {
      next.push(events[index]!)
    }
    events = next
  }

  prepend(initialInputs)
  return {
    read() {
      assertActive()
      return [...events]
    },
    prepend,
    query(input) {
      assertActive()
      return queryDashboardRuntimeEvents(events, dropped, input)
    },
    dispose() {
      disposed = true
      events = []
    },
  }
}
