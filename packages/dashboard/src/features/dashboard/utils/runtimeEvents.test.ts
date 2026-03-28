import { describe, expect, it } from 'vitest'
import { formatRuntimeSourceSummary, normalizeRuntimeEvents, summarizeRuntimeEventsBySource } from './runtimeEvents'

describe('normalizeRuntimeEvents', () => {
  it('normalizes partial event payloads and fills defaults', () => {
    expect(normalizeRuntimeEvents({
      id: 'evt-1',
      kind: 'build',
      title: 'build completed',
    })).toEqual([
      {
        id: 'evt-1',
        kind: 'build',
        level: 'info',
        title: 'build completed',
        detail: 'no event detail',
        timestamp: '—',
        source: 'dashboard',
        durationMs: undefined,
        tags: undefined,
      },
    ])
  })

  it('drops invalid entries and deduplicates by id', () => {
    expect(normalizeRuntimeEvents([
      null,
      {
        id: 'evt-dup',
        kind: 'hmr',
        level: 'success',
        title: 'first',
        detail: 'first detail',
        timestamp: '10:00:00',
      },
      {
        id: 'evt-dup',
        kind: 'hmr',
        level: 'warning',
        title: 'second',
        detail: 'second detail',
        timestamp: '10:01:00',
        tags: ['hmr', '', 1],
      },
    ])).toEqual([
      {
        id: 'evt-dup',
        kind: 'hmr',
        level: 'warning',
        title: 'second',
        detail: 'second detail',
        timestamp: '10:01:00',
        source: 'dashboard',
        durationMs: undefined,
        tags: ['hmr'],
      },
    ])
  })

  it('summarizes runtime events by source with average duration', () => {
    expect(summarizeRuntimeEventsBySource([
      {
        id: 'evt-1',
        kind: 'command',
        level: 'success',
        title: 'first',
        detail: 'first detail',
        timestamp: '10:00:00',
        source: 'cli',
        durationMs: 200,
      },
      {
        id: 'evt-2',
        kind: 'command',
        level: 'error',
        title: 'second',
        detail: 'second detail',
        timestamp: '10:01:00',
        source: 'cli',
      },
      {
        id: 'evt-3',
        kind: 'hmr',
        level: 'info',
        title: 'third',
        detail: 'third detail',
        timestamp: '10:02:00',
        source: 'vite-hmr',
        durationMs: 40,
      },
    ])).toEqual([
      {
        source: 'cli',
        count: 2,
        errorCount: 1,
        latestTimestamp: '10:00:00',
        averageDurationMs: 200,
      },
      {
        source: 'vite-hmr',
        count: 1,
        errorCount: 0,
        latestTimestamp: '10:02:00',
        averageDurationMs: 40,
      },
    ])
  })

  it('formats runtime source summaries for source cards', () => {
    expect(formatRuntimeSourceSummary([
      {
        source: 'cli',
        count: 2,
        errorCount: 1,
        latestTimestamp: '10:00:00',
        averageDurationMs: 200,
      },
      {
        source: 'vite-hmr',
        count: 1,
        errorCount: 0,
        latestTimestamp: '10:02:00',
      },
    ])).toEqual([
      {
        source: 'cli',
        count: 2,
        errorCount: 1,
        latestTimestamp: '10:00:00',
        averageDurationMs: 200,
        averageDuration: '200 ms',
      },
      {
        source: 'vite-hmr',
        count: 1,
        errorCount: 0,
        latestTimestamp: '10:02:00',
        averageDuration: '未记录',
      },
    ])
  })
})
