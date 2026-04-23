import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { analyzeHmrProfile } from './hmr'

describe('analyze hmr profile', () => {
  it('aggregates jsonl samples and skips invalid lines', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-hmr-profile-'))
    const profilePath = path.join(root, 'hmr-profile.jsonl')

    await fs.writeFile(profilePath, [
      JSON.stringify({
        timestamp: '2026-04-23T10:00:00.000Z',
        totalMs: 30,
        event: 'update',
        file: '/project/src/pages/home/index.vue',
        watchToDirtyMs: 3,
        emitMs: 10,
        sharedChunkResolveMs: 1,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      }),
      '{invalid',
      JSON.stringify({
        timestamp: '2026-04-23T10:01:00.000Z',
        totalMs: 50,
        event: 'create',
        file: '/project/src/pages/logs/index.vue',
        watchToDirtyMs: 4,
        emitMs: 12,
        sharedChunkResolveMs: 2,
        dirtyReasonSummary: ['entry-direct:1', 'importer-graph:1'],
        pendingReasonSummary: ['layout-propagation:1'],
      }),
      '',
    ].join('\n'), 'utf8')

    const result = await analyzeHmrProfile({
      profilePath,
      now: new Date('2026-04-23T12:00:00.000Z'),
    })

    expect(result.runtime).toBe('mini')
    expect(result.kind).toBe('hmr-profile')
    expect(result.sampleCount).toBe(2)
    expect(result.skippedLineCount).toBe(1)
    expect(result.firstTimestamp).toBe('2026-04-23T10:00:00.000Z')
    expect(result.lastTimestamp).toBe('2026-04-23T10:01:00.000Z')
    expect(result.metrics.totalMs.averageMs).toBe(40)
    expect(result.metrics.totalMs.maxMs).toBe(50)
    expect(result.metrics.watchToDirtyMs.averageMs).toBe(3.5)
    expect(result.events).toEqual([
      { name: 'create', count: 1 },
      { name: 'update', count: 1 },
    ])
    expect(result.dirtyReasons).toEqual([
      { name: 'entry-direct:1', count: 2 },
      { name: 'importer-graph:1', count: 1 },
    ])
    expect(result.pendingReasons).toEqual([
      { name: 'layout-propagation:1', count: 1 },
      { name: 'shared-chunk(common.js)+1:direct', count: 1 },
    ])
    expect(result.slowestSamples[0]?.file).toBe('/project/src/pages/logs/index.vue')
  })
})
