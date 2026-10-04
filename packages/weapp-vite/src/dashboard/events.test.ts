import type { DashboardRuntimeEventInput, DashboardRuntimeEventProfile, DashboardRuntimeEventStore } from './events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { createDashboardRuntimeEventStore } from './events'
import { dashboardRuntimeEventsPageSchema } from './eventsQuery'

const stores: DashboardRuntimeEventStore[] = []

function createEvent(title: string, overrides: Partial<DashboardRuntimeEventInput> = {}): DashboardRuntimeEventInput {
  return { kind: 'system', level: 'info', title, detail: '', ...overrides }
}

function createStore(inputs: DashboardRuntimeEventInput[] = []) {
  const store = createDashboardRuntimeEventStore(inputs)
  stores.push(store)
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-03T00:00:00.000Z'))
})

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.dispose()
  }
  vi.useRealTimers()
})

describe('dashboard runtime event queries', () => {
  it('intersects filters and preserves profile values in the returned contract', () => {
    const profile: Required<DashboardRuntimeEventProfile> = {
      timestamp: '2025-01-01T00:00:00Z',
      totalMs: 31,
      eventId: 'watch-7',
      event: 'change',
      file: 'src/page.ts',
      relativeFile: 'page.ts',
      sourceRootFile: 'page.ts',
      buildCoreMs: 2,
      buildStartMs: 3,
      pluginResolveMs: 4,
      transformMs: 5,
      snapshotResolveMs: 6,
      snapshotBuildMs: 7,
      writeMs: 8,
      watchToDirtyMs: 9,
      emitMs: 10,
      sharedChunkResolveMs: 11,
      resolveCount: 12,
      dirtyCount: 13,
      pendingCount: 14,
      emittedCount: 15,
      dirtyReasonSummary: ['source-change'],
      pendingReasonSummary: ['dependent-module'],
    }
    const selected = createEvent('Page refreshed', {
      kind: 'hmr',
      level: 'success',
      source: 'watcher',
      detail: 'Updated page module',
      durationMs: 31,
      tags: ['refresh', 'typescript'],
      profile,
    })
    const store = createStore([
      selected,
      { ...selected, title: 'Second refresh' },
      { ...selected, title: 'Wrong kind refresh', kind: 'build' },
      { ...selected, title: 'Wrong level refresh', level: 'error' },
      { ...selected, title: 'Wrong source refresh', source: 'cli' },
      createEvent('No keyword', { kind: 'hmr', level: 'success', source: 'watcher' }),
    ])
    const page = dashboardRuntimeEventsPageSchema.parse(store.query({
      kind: 'hmr',
      level: 'success',
      source: 'watcher',
      query: '  ReFrEsH  ',
      since: '2026-10-03T00:00:00Z',
      limit: 1,
    }))
    expect(page.items.map(event => event.title)).toEqual(['Page refreshed'])
    expect(page.items[0]).toMatchObject({
      durationMs: 31,
      tags: ['refresh', 'typescript'],
      occurredAt: '2026-10-03T00:00:00.000Z',
      profile,
    })
    expect(page.total).toBe(2)
    expect(page.retention).toEqual({
      capacity: 24,
      retained: 6,
      dropped: 0,
      oldestOccurredAt: '2026-10-03T00:00:00.000Z',
    })
    expect(store.query({ source: 'WATCHER' }).items).toEqual([])
  })

  it.each(['compile', 'entry.ts', 'build', 'warning', 'bundler', 'shared'])('matches text %j across event fields', (query) => {
    const store = createStore([
      createEvent('Compile finished', {
        kind: 'build',
        level: 'warning',
        detail: 'entry.ts changed',
        source: 'bundler',
        tags: ['shared'],
      }),
      createEvent('Unrelated'),
    ])
    expect(store.query({ query: query.toUpperCase() }).items.map(event => event.title)).toEqual(['Compile finished'])
  })

  it('uses inclusive ISO instants rather than display time or profile timestamps', () => {
    vi.setSystemTime(new Date('2026-10-02T23:59:59.999Z'))
    const store = createStore([createEvent('before')])
    const boundary = new Date('2026-10-03T00:00:00.000Z')
    vi.setSystemTime(boundary)
    store.prepend([createEvent('boundary', { profile: { timestamp: '2024-01-01T00:00:00Z' } })])
    vi.setSystemTime(new Date('2026-10-03T00:00:00.001Z'))
    store.prepend([createEvent('after')])

    const page = store.query({ since: '2026-10-03T08:00:00+08:00', until: boundary.toISOString() })
    expect(page.items.map(event => event.title)).toEqual(['boundary'])
    expect(page.items[0]).toMatchObject({
      occurredAt: boundary.toISOString(),
      timestamp: boundary.toLocaleTimeString('zh-CN', { hour12: false }),
    })
    expect(store.query({ since: boundary.toISOString() }).items.map(event => event.title)).toEqual(['after', 'boundary'])
    expect(store.query({ until: boundary.toISOString() }).items.map(event => event.title)).toEqual(['boundary', 'before'])
    expect(store.query({ since: '2026-10-03T00:00:00.002Z' }).items).toEqual([])
    expect(store.query({ until: '2026-10-02T23:59:59.998Z' }).items).toEqual([])
    expect(page.retention.oldestOccurredAt).toBe('2026-10-02T23:59:59.999Z')
  })

  it.each([
    { kind: 'trace' },
    { level: 'fatal' },
    { source: 1 },
    { query: false },
    { limit: 0 },
    { limit: 25 },
    { limit: 1.5 },
    { limit: Number.NaN },
    { since: 'not-a-date' },
    { since: '2026-02-30T00:00:00Z' },
    { until: '2026-13-01T00:00:00Z' },
    { since: '2026-10-03' },
    { until: '2026-10-03T00:00:00' },
    { since: '2026-10-04T00:00:00Z', until: '2026-10-03T00:00:00Z' },
  ])('rejects invalid query %j', (input) => {
    expect(() => createStore().query(input)).toThrow(ZodError)
  })
})

describe('dashboard runtime event retention', () => {
  it('caps initial and prepended batches in caller order and counts every discarded event', () => {
    const store = createStore(Array.from({ length: 30 }, (_, index) => createEvent(`initial-${index}`)))
    expect(store.read().map(event => event.title)).toEqual(Array.from({ length: 24 }, (_, index) => `initial-${index}`))
    expect(store.query({}).retention).toEqual({
      capacity: 24,
      retained: 24,
      dropped: 6,
      oldestOccurredAt: '2026-10-03T00:00:00.000Z',
    })
    vi.setSystemTime(new Date('2026-10-03T00:00:01.000Z'))
    store.prepend([createEvent('new-first'), createEvent('new-second')])
    expect(store.read().map(event => event.title)).toEqual([
      'new-first',
      'new-second',
      ...Array.from({ length: 22 }, (_, index) => `initial-${index}`),
    ])
    expect(store.query({ query: 'initial-23' })).toMatchObject({
      items: [],
      total: 0,
      retention: { retained: 24, dropped: 8, oldestOccurredAt: '2026-10-03T00:00:00.000Z' },
    })

    vi.setSystemTime(new Date('2026-10-03T00:00:02.000Z'))
    store.prepend(Array.from({ length: 30 }, (_, index) => createEvent(`batch-${index}`, {
      kind: index % 2 === 0 ? 'diagnostic' : 'build',
    })))
    const page = store.query({ kind: 'build', limit: 2 })
    expect(page.items.map(event => event.title)).toEqual(['batch-1', 'batch-3'])
    expect(page.total).toBe(12)
    expect(page.retention).toEqual({
      capacity: 24,
      retained: 24,
      dropped: 38,
      oldestOccurredAt: '2026-10-03T00:00:02.000Z',
    })
    expect(store.read().map(event => event.title)).toEqual(Array.from({ length: 24 }, (_, index) => `batch-${index}`))
    store.prepend([])
    expect(store.query({ kind: 'build', limit: 2 })).toEqual(page)
  })

  it('keeps retention independent of returned-array edits and isolates store lifecycles', () => {
    const store = createStore([createEvent('kept')])
    const other = createStore()
    store.read().pop()
    store.query({}).items.pop()
    expect(store.query({}).items.map(event => event.title)).toEqual(['kept'])
    expect(other.query({})).toEqual({
      items: [],
      total: 0,
      retention: { capacity: 24, retained: 0, dropped: 0, oldestOccurredAt: null },
    })

    store.dispose()
    store.dispose()
    store.prepend([createEvent('must not reopen')])
    expect(() => store.read()).toThrow('Dashboard 事件会话已关闭。')
    expect(() => store.query({})).toThrow('Dashboard 事件会话已关闭。')
    other.prepend([createEvent('still active')])
    expect(other.query({}).items.map(event => event.title)).toEqual(['still active'])
  })
})
