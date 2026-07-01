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
        buildCoreMs: 16,
        transformMs: 8,
        coreTransformMs: 3,
        wevuTransformMs: 2,
        vueTransformMs: 4,
        coreLoadMs: 5,
        entryLoadMs: 3,
        requestGlobalsMs: 1,
        weapiResolveMs: 0.5,
        renderStartMs: 1,
        generateBundleMs: 6,
        generateSharedMs: 2,
        generateRewriteMs: 3,
        generateModuleGraphMs: 1,
        writeMs: 2,
        watchToDirtyMs: 3,
        emitMs: 10,
        sharedChunkResolveMs: 1,
        chunkEmitCount: 2,
        loadCount: 1,
        skippedLoadedCount: 0,
        dirtyReasonSummary: ['entry-direct:1'],
        pendingReasonSummary: ['shared-chunk(common.js)+1:direct'],
      }),
      '{invalid',
      JSON.stringify({
        timestamp: '2026-04-23T10:01:00.000Z',
        totalMs: 50,
        event: 'create',
        file: '/project/src/pages/logs/index.vue',
        buildCoreMs: 28,
        transformMs: 12,
        coreTransformMs: 5,
        wevuTransformMs: 4,
        vueTransformMs: 8,
        coreLoadMs: 9,
        entryLoadMs: 5,
        requestGlobalsMs: 3,
        weapiResolveMs: 1.5,
        renderStartMs: 3,
        generateBundleMs: 10,
        generateSharedMs: 4,
        generateRewriteMs: 6,
        generateModuleGraphMs: 2,
        writeMs: 4,
        watchToDirtyMs: 4,
        emitMs: 12,
        sharedChunkResolveMs: 2,
        chunkEmitCount: 4,
        loadCount: 3,
        skippedLoadedCount: 2,
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
    expect(result.metrics.buildCoreMs.averageMs).toBe(22)
    expect(result.metrics.transformMs.averageMs).toBe(10)
    expect(result.metrics.coreTransformMs.averageMs).toBe(4)
    expect(result.metrics.wevuTransformMs.averageMs).toBe(3)
    expect(result.metrics.vueTransformMs.averageMs).toBe(6)
    expect(result.metrics.coreLoadMs.averageMs).toBe(7)
    expect(result.metrics.entryLoadMs.averageMs).toBe(4)
    expect(result.metrics.requestGlobalsMs.averageMs).toBe(2)
    expect(result.metrics.weapiResolveMs.averageMs).toBe(1)
    expect(result.metrics.renderStartMs.averageMs).toBe(2)
    expect(result.metrics.generateBundleMs.averageMs).toBe(8)
    expect(result.metrics.generateSharedMs.averageMs).toBe(3)
    expect(result.metrics.generateRewriteMs.averageMs).toBe(4.5)
    expect(result.metrics.generateModuleGraphMs.averageMs).toBe(1.5)
    expect(result.metrics.writeMs.averageMs).toBe(3)
    expect(result.metrics.watchToDirtyMs.averageMs).toBe(3.5)
    expect(result.operations.chunkEmitCount.average).toBe(3)
    expect(result.operations.chunkEmitCount.max).toBe(4)
    expect(result.operations.loadCount.average).toBe(2)
    expect(result.operations.skippedLoadedCount.average).toBe(1)
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
