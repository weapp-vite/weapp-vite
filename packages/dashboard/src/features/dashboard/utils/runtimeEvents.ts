import type {
  DashboardRuntimeEvent,
  DashboardRuntimeEventKind,
  DashboardRuntimeEventLevel,
  DashboardRuntimeSourceCardItem,
  DashboardRuntimeSourceSummary,
} from '../types'
import { formatDuration } from './format'

const EVENT_KINDS: DashboardRuntimeEventKind[] = ['command', 'build', 'diagnostic', 'hmr', 'system']
const EVENT_LEVELS: DashboardRuntimeEventLevel[] = ['info', 'success', 'warning', 'error']

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input)
}

function normalizeEventKind(value: unknown): DashboardRuntimeEventKind {
  return typeof value === 'string' && EVENT_KINDS.includes(value as DashboardRuntimeEventKind)
    ? value as DashboardRuntimeEventKind
    : 'system'
}

function normalizeEventLevel(value: unknown): DashboardRuntimeEventLevel {
  return typeof value === 'string' && EVENT_LEVELS.includes(value as DashboardRuntimeEventLevel)
    ? value as DashboardRuntimeEventLevel
    : 'info'
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim()
    ? value
    : fallback
}

function normalizeDuration(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const tags = value
    .filter(tag => typeof tag === 'string' && tag.trim())
    .map(tag => String(tag))

  return tags.length > 0 ? tags : undefined
}

function normalizeRuntimeEvent(input: unknown, index: number): DashboardRuntimeEvent | null {
  if (!isRecord(input)) {
    return null
  }

  return {
    id: normalizeString(input.id, `dashboard-runtime-event-${index}`),
    kind: normalizeEventKind(input.kind),
    level: normalizeEventLevel(input.level),
    title: normalizeString(input.title, 'untitled event'),
    detail: normalizeString(input.detail, 'no event detail'),
    timestamp: normalizeString(input.timestamp, '—'),
    source: normalizeString(input.source, 'dashboard'),
    durationMs: normalizeDuration(input.durationMs),
    tags: normalizeTags(input.tags),
  }
}

export function normalizeRuntimeEvents(input: unknown) {
  const events = Array.isArray(input) ? input : [input]
  const normalized = events
    .map((event, index) => normalizeRuntimeEvent(event, index))
    .filter((event): event is DashboardRuntimeEvent => Boolean(event))

  const deduped = new Map<string, DashboardRuntimeEvent>()
  for (const event of normalized) {
    deduped.set(event.id, event)
  }

  return [...deduped.values()]
}

export function summarizeRuntimeEventsBySource(events: DashboardRuntimeEvent[]): DashboardRuntimeSourceSummary[] {
  const sourceMap = new Map<string, {
    count: number
    errorCount: number
    latestTimestamp: string
    durationTotal: number
    timedCount: number
  }>()

  for (const event of events) {
    const source = event.source ?? 'dashboard'
    const existing = sourceMap.get(source)

    if (!existing) {
      sourceMap.set(source, {
        count: 1,
        errorCount: event.level === 'error' ? 1 : 0,
        latestTimestamp: event.timestamp,
        durationTotal: event.durationMs ?? 0,
        timedCount: typeof event.durationMs === 'number' ? 1 : 0,
      })
      continue
    }

    sourceMap.set(source, {
      count: existing.count + 1,
      errorCount: existing.errorCount + (event.level === 'error' ? 1 : 0),
      latestTimestamp: existing.latestTimestamp,
      durationTotal: existing.durationTotal + (event.durationMs ?? 0),
      timedCount: existing.timedCount + (typeof event.durationMs === 'number' ? 1 : 0),
    })
  }

  return Array.from(sourceMap, ([source, meta]) => ({
    source,
    count: meta.count,
    errorCount: meta.errorCount,
    latestTimestamp: meta.latestTimestamp,
    averageDurationMs: meta.timedCount > 0
      ? Math.round(meta.durationTotal / meta.timedCount)
      : undefined,
  }))
    .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source, 'zh-CN'))
}

export function formatRuntimeSourceSummary(items: DashboardRuntimeSourceSummary[]): DashboardRuntimeSourceCardItem[] {
  return items.map(item => ({
    ...item,
    averageDuration: formatDuration(item.averageDurationMs),
  }))
}
