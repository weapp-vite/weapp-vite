import { describe, expect, it, vi } from 'vitest'
import { createChunkEmitter } from '@/plugins/hooks/useLoadEntry/chunkEmitter'

describe('createChunkEmitter', () => {
  it('normalizes vue virtual ids before tracking loaded entries', async () => {
    const loadedEntrySet = new Set<string>()
    const configService = {
      relativeOutputPath: (id: string) => id.replace('/project/src/', ''),
    }
    const emitEntriesChunks = createChunkEmitter(configService as any, loadedEntrySet)

    const load = vi.fn(async () => {})
    const emitFile = vi.fn()
    const ctx = { load, emitFile } as any
    const resolved = { id: '\0vue:/project/src/components/HelloWorld/index.vue' }

    await Promise.all(emitEntriesChunks.call(ctx, [resolved as any]))

    expect(load).toHaveBeenCalled()
    expect(loadedEntrySet.has('/project/src/components/HelloWorld/index.vue')).toBe(true)
    expect(loadedEntrySet.has(resolved.id)).toBe(false)
  })
})
