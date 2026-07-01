import { describe, expect, it, vi } from 'vitest'
import { createChunkEmitter } from './chunkEmitter'

describe('createChunkEmitter', () => {
  it('tracks entries emitted during nested preload discovery', async () => {
    const loadedEntrySet = new Set<string>()
    const trackedEntryIds: string[] = []
    const emitEntriesChunks = createChunkEmitter(
      {
        relativeOutputPath(id: string) {
          return id.replace('/project/src/', '')
        },
      } as any,
      loadedEntrySet,
      undefined,
      entryId => trackedEntryIds.push(entryId),
    )

    const pluginCtx = {
      emitFile: vi.fn(),
      load: vi.fn(async (resolvedId: { id: string }) => {
        if (resolvedId.id !== '/project/src/pages/index/index.ts') {
          return null
        }
        await Promise.all(emitEntriesChunks.call(pluginCtx as any, [
          { id: '/project/src/components/HotCard/index.vue' } as any,
        ]))
        return null
      }),
    }

    const stats = await Promise.all(emitEntriesChunks.call(pluginCtx as any, [
      { id: '/project/src/pages/index/index.ts' } as any,
    ]))

    expect(stats).toEqual([{
      chunkEmitCount: 1,
      loadCount: 1,
      skippedLoadedCount: 0,
    }])
    expect(trackedEntryIds).toEqual([
      '/project/src/components/HotCard/index.vue',
      '/project/src/pages/index/index.ts',
    ])
  })

  it('preloads and tracks root inputs without emitting duplicate chunks', async () => {
    const loadedEntrySet = new Set<string>()
    const trackedEntryIds: string[] = []
    const emitEntriesChunks = createChunkEmitter(
      {
        relativeOutputPath(id: string) {
          return id.replace('/project/src/', '')
        },
      } as any,
      loadedEntrySet,
      undefined,
      entryId => trackedEntryIds.push(entryId),
      undefined,
      entryId => entryId !== '/project/src/app.vue',
    )

    const pluginCtx = {
      emitFile: vi.fn(),
      load: vi.fn(async () => null),
    }

    const stats = await Promise.all(emitEntriesChunks.call(pluginCtx as any, [
      { id: '/project/src/app.vue' } as any,
      { id: '/project/src/pages/index/index.vue' } as any,
    ]))

    expect(stats).toEqual([
      {
        chunkEmitCount: 0,
        loadCount: 1,
        skippedLoadedCount: 0,
      },
      {
        chunkEmitCount: 1,
        loadCount: 1,
        skippedLoadedCount: 0,
      },
    ])
    expect(pluginCtx.load).toHaveBeenCalledWith({ id: '/project/src/app.vue' })
    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(pluginCtx.emitFile).toHaveBeenCalledWith(expect.objectContaining({
      id: '/project/src/pages/index/index.vue',
      fileName: 'pages/index/index.js',
    }))
    expect(trackedEntryIds).toEqual([
      '/project/src/app.vue',
      '/project/src/pages/index/index.vue',
    ])
  })

  it('uses asset-only preload for entries that skip chunk emit', async () => {
    const loadedEntrySet = new Set<string>()
    const trackedEntryIds: string[] = []
    const preloadAssetOnlyEntry = vi.fn(async () => {})
    const shouldEmitEntryChunk = vi.fn(entryId => entryId !== '/project/src/pages/hmr/index.ts')
    const emitEntriesChunks = createChunkEmitter(
      {
        relativeOutputPath(id: string) {
          return id.replace('/project/src/', '')
        },
      } as any,
      loadedEntrySet,
      undefined,
      entryId => trackedEntryIds.push(entryId),
      undefined,
      shouldEmitEntryChunk,
      preloadAssetOnlyEntry,
    )

    const pluginCtx = {
      emitFile: vi.fn(),
      load: vi.fn(async () => null),
    }
    const resolvedId = { id: '/project/src/pages/hmr/index.ts' } as any

    const stats = await Promise.all(emitEntriesChunks.call(pluginCtx as any, [resolvedId]))

    expect(stats).toEqual([{
      chunkEmitCount: 0,
      loadCount: 1,
      skippedLoadedCount: 0,
    }])
    expect(preloadAssetOnlyEntry).toHaveBeenCalledWith(resolvedId, '/project/src/pages/hmr/index.ts')
    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(trackedEntryIds).toEqual(['/project/src/pages/hmr/index.ts'])
    expect(shouldEmitEntryChunk).toHaveBeenCalledTimes(1)
  })

  it('tracks skipped preloads for entries already loaded', async () => {
    const id = '/project/src/pages/index/index.ts'
    const loadedEntrySet = new Set<string>([id])
    const emitEntriesChunks = createChunkEmitter(
      {
        relativeOutputPath(input: string) {
          return input.replace('/project/src/', '')
        },
      } as any,
      loadedEntrySet,
    )
    const pluginCtx = {
      emitFile: vi.fn(),
      load: vi.fn(async () => null),
    }

    const stats = await Promise.all(emitEntriesChunks.call(pluginCtx as any, [{ id } as any]))

    expect(stats).toEqual([{
      chunkEmitCount: 1,
      loadCount: 0,
      skippedLoadedCount: 1,
    }])
    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })
})
