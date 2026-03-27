import { describe, expect, it } from 'vitest'
import { normalizeRuntimeEvents } from './runtimeEvents'

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
})
