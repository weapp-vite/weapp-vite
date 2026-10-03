import type { DashboardRuntimeEvent } from './events'
import { z } from 'zod'
import { dashboardRuntimeEventSchema } from './schema'

export const DASHBOARD_RUNTIME_EVENT_CAPACITY = 24

const occurredAtFilterSchema = z.string().datetime({ offset: true }).describe('Inclusive ISO timestamp with Z or an explicit timezone offset.')

export const dashboardRuntimeEventsQueryRequestSchema = z.object({
  kind: dashboardRuntimeEventSchema.shape.kind.optional(),
  level: dashboardRuntimeEventSchema.shape.level.optional(),
  source: z.string().optional().describe('Exact event source, case-sensitive.'),
  query: z.string().optional().describe('Case-insensitive text in title, detail, kind, level, source or tags.'),
  since: occurredAtFilterSchema.optional(),
  until: occurredAtFilterSchema.optional(),
  limit: z.number().int().min(1).max(DASHBOARD_RUNTIME_EVENT_CAPACITY).optional(),
}).refine(input => !input.since || !input.until || Date.parse(input.since) <= Date.parse(input.until), {
  message: '事件查询的 since 不得晚于 until。',
  path: ['until'],
})

export const dashboardRuntimeEventsPageSchema = z.object({
  items: z.array(dashboardRuntimeEventSchema).max(DASHBOARD_RUNTIME_EVENT_CAPACITY),
  total: z.number().int().nonnegative().max(DASHBOARD_RUNTIME_EVENT_CAPACITY),
  retention: z.object({
    capacity: z.literal(DASHBOARD_RUNTIME_EVENT_CAPACITY),
    retained: z.number().int().nonnegative().max(DASHBOARD_RUNTIME_EVENT_CAPACITY),
    dropped: z.number().int().nonnegative(),
    oldestOccurredAt: dashboardRuntimeEventSchema.shape.occurredAt.nullable(),
  }),
})

export type DashboardRuntimeEventsQueryRequest = z.infer<typeof dashboardRuntimeEventsQueryRequestSchema>
export type DashboardRuntimeEventsPage = z.infer<typeof dashboardRuntimeEventsPageSchema>

function matchesEventText(event: DashboardRuntimeEvent, query: string) {
  return [event.title, event.detail, event.kind, event.level, event.source, ...(event.tags ?? [])]
    .join(' ')
    .toLowerCase()
    .includes(query)
}

/** 查询当前保留的事件；匹配总数与丢弃计数不受返回条数影响。 */
export function queryDashboardRuntimeEvents(
  events: readonly DashboardRuntimeEvent[],
  dropped: number,
  input: unknown,
): DashboardRuntimeEventsPage {
  const request = dashboardRuntimeEventsQueryRequestSchema.parse(input)
  const since = request.since === undefined ? undefined : Date.parse(request.since)
  const until = request.until === undefined ? undefined : Date.parse(request.until)
  const query = request.query?.trim().toLowerCase()
  const limit = request.limit ?? DASHBOARD_RUNTIME_EVENT_CAPACITY
  const items: DashboardRuntimeEvent[] = []
  let total = 0
  let oldestOccurredAt: string | null = null

  for (const event of events) {
    if (oldestOccurredAt === null || event.occurredAt < oldestOccurredAt) {
      oldestOccurredAt = event.occurredAt
    }
    if (request.kind !== undefined && event.kind !== request.kind) {
      continue
    }
    if (request.level !== undefined && event.level !== request.level) {
      continue
    }
    if (request.source !== undefined && event.source !== request.source) {
      continue
    }
    if (since !== undefined || until !== undefined) {
      const occurredAt = Date.parse(event.occurredAt)
      if ((since !== undefined && occurredAt < since) || (until !== undefined && occurredAt > until)) {
        continue
      }
    }
    if (query && !matchesEventText(event, query)) {
      continue
    }
    total++
    if (items.length < limit) {
      items.push(event)
    }
  }

  return {
    items,
    total,
    retention: {
      capacity: DASHBOARD_RUNTIME_EVENT_CAPACITY,
      retained: events.length,
      dropped,
      oldestOccurredAt,
    },
  }
}
