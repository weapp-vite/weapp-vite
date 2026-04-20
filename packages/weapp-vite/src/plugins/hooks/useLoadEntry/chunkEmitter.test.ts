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

    await Promise.all(emitEntriesChunks.call(pluginCtx as any, [
      { id: '/project/src/pages/index/index.ts' } as any,
    ]))

    expect(trackedEntryIds).toEqual([
      '/project/src/components/HotCard/index.vue',
      '/project/src/pages/index/index.ts',
    ])
  })
})
