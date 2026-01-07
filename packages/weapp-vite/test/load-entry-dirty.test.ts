import { describe, expect, it, vi } from 'vitest'
import { useLoadEntry } from '@/plugins/hooks/useLoadEntry'

describe('useLoadEntry markEntryDirty', () => {
  const baseCtx = {
    configService: {
      isDev: true,
      absoluteSrcRoot: '/project/src',
      aliasEntries: [],
      packageJson: { dependencies: {} },
      relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
      relativeOutputPath: (id: string) => id.replace('/project/src/', ''),
      weappViteConfig: {},
    },
    wxmlService: {
      wxmlComponentsMap: new Map(),
    },
    autoImportService: {
      resolve: () => undefined,
    },
  }

  it('evicts dirty entries from the loaded set', () => {
    const ctx = { ...baseCtx } as any

    const { loadedEntrySet, markEntryDirty } = useLoadEntry(ctx)
    const entryId = '/project/src/components/hello.vue'

    loadedEntrySet.add(entryId)
    markEntryDirty(entryId)

    expect(loadedEntrySet.has(entryId)).toBe(false)
  })

  it('emits dirty entries using cached resolutions', async () => {
    const ctx = { ...baseCtx } as any
    const { loadedEntrySet, resolvedEntryMap, markEntryDirty, emitDirtyEntries } = useLoadEntry(ctx)

    const entryId = '/project/src/components/hello.vue'
    resolvedEntryMap.set(entryId, { id: entryId } as any)
    loadedEntrySet.add(entryId)
    markEntryDirty(entryId)

    const load = vi.fn(async () => {})
    const emitFile = vi.fn()
    await emitDirtyEntries.call({ load, emitFile } as any)

    expect(load).toHaveBeenCalled()
    expect(emitFile).toHaveBeenCalled()
  })
})
