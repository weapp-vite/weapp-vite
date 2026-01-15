import { describe, expect, it, vi } from 'vitest'
import { useLoadEntry } from './index'

function createContext() {
  return {
    configService: {
      isDev: true,
      absoluteSrcRoot: '/project/src',
      aliasEntries: [],
      packageJson: { dependencies: {} },
      options: { cwd: '/project' },
      relativeOutputPath(id: string) {
        return id
      },
      relativeAbsoluteSrcRoot(id: string) {
        return id
      },
    },
    wxmlService: {
      scan: vi.fn(async () => null),
      setWxmlComponentsMap: vi.fn(),
      wxmlComponentsMap: new Map<string, Record<string, unknown>>(),
    },
    autoImportService: {
      resolve: vi.fn(() => null),
    },
  } as any
}

function createPluginContext() {
  return {
    load: vi.fn(async () => null),
    emitFile: vi.fn(),
  } as any
}

function seedResolvedEntries(
  resolvedEntryMap: Map<string, { id: string }>,
  ids: string[],
) {
  for (const id of ids) {
    resolvedEntryMap.set(id, { id })
  }
}

describe('useLoadEntry emitDirtyEntries', () => {
  it('emits all entries in full mode', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'full',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
  })

  it('falls back to full when shared chunk is only partially updated', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set([ids[0], ids[1]]))
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
  })

  it('keeps partial rebuild when shared chunk importers are fully dirty', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set([ids[0], ids[1]]))
    hook.markEntryDirty(ids[0])
    hook.markEntryDirty(ids[1])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(2)
  })

  it('respects off mode for incremental rebuilds', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('keeps incremental rebuilds when no shared chunks are detected', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('falls back to full when shared chunk importers are unavailable', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
  })

  it('forces full rebuild when any shared chunk is partially dirty', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js', '/project/src/d.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common-a.js', new Set([ids[0], ids[1]]))
    sharedChunkImporters.set('common-b.js', new Set([ids[2], ids[3]]))
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(4)
  })
})
