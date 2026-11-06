import type { PluginContext } from 'rolldown'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { useLoadEntry } from './index'

const loader = vi.hoisted(() => vi.fn())
const debug = vi.hoisted(() => vi.fn())

vi.mock('../../../debugger', () => ({ createDebugger: () => debug }))
vi.mock('./loadEntry', () => ({
  createEntryLoader: (options: unknown) => Object.assign(
    async function (this: PluginContext, id: string) {
      return await loader.call(this, options, id)
    },
    { invalidateResolveCache: vi.fn() },
  ),
}))

function createContext() {
  return {
    runtimeState: createRuntimeState(),
    moduleGraphService: {
      invalidate: vi.fn(),
      removeEntryDependencies: vi.fn(),
      replaceEntryDependencies: vi.fn(),
    },
    configService: {
      isDev: true,
      aliasEntries: [],
      outputExtensions: { wxss: 'wxss' },
      packageJson: { dependencies: {} },
      options: {},
      relativeOutputPath: (id: string) => id,
      relativeAbsoluteSrcRoot: (id: string) => id,
    },
    scanService: {
      subPackageMap: new Map(),
      independentSubPackageMap: new Map(),
      markDirty: vi.fn(),
      loadAppEntry: vi.fn(async () => ({ path: 'app.ts' })),
      loadSubPackages: vi.fn(),
      drainIndependentDirtyRoots: vi.fn(() => []),
    },
    wxmlService: { scan: vi.fn(), setWxmlComponentsMap: vi.fn(), wxmlComponentsMap: new Map() },
    autoImportService: { resolve: vi.fn() },
  } as any
}

function createPluginContext() {
  return { load: vi.fn(async () => null), emitFile: vi.fn() } as any
}

function emitDiscoveredEntries(ids: string[]) {
  return async function (this: PluginContext, options: any, app: string) {
    options.resolvedEntryMap.set(app, { id: app })
    for (const id of ids) {
      options.resolvedEntryMap.set(id, { id })
    }
    await Promise.all(options.emitEntriesChunks.call(this, ids.map(id => ({ id }))))
    return { code: '' }
  }
}

describe('complete entry scan emission profile', () => {
  beforeEach(() => {
    loader.mockReset()
    debug.mockClear()
  })

  it('records successful complete scans with independent operation counts for each generation', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.fullEntryScan = true
    ctx.runtimeState.build.hmr.profile = { eventId: 'first' }
    const setDidEmitAllEntries = vi.fn()
    const hook = useLoadEntry(ctx, { hmr: { setDidEmitAllEntries } })
    hook.markEntryDirty('pages/first.ts')
    loader.mockImplementationOnce(emitDiscoveredEntries(['pages/first.ts', 'pages/retired.ts']))

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      eventId: 'first',
      dirtyCount: 1,
      pendingCount: 3,
      emittedCount: 2,
      chunkEmitCount: 2,
      loadCount: 2,
      skippedLoadedCount: 0,
      emitMs: expect.any(Number),
      entryChunkLoadMs: expect.any(Number),
      entryChunkEmitFileMs: expect.any(Number),
      pendingReasonSummary: ['full-rebuild'],
    })
    expect(debug).toHaveBeenCalledWith('hmr emit dirty=1 resolved=3 emitAll=true pending=3 registration=3 scan=full')

    ctx.runtimeState.build.hmr.profile = { eventId: 'second' }
    hook.markEntryDirty('pages/retained.ts')
    loader.mockImplementationOnce(emitDiscoveredEntries(['pages/retained.ts']))
    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      eventId: 'second',
      dirtyCount: 1,
      pendingCount: 2,
      emittedCount: 1,
      chunkEmitCount: 1,
      loadCount: 1,
      skippedLoadedCount: 0,
    })
    expect(hook.resolvedEntryMap.has('pages/retired.ts')).toBe(false)
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(true)
    expect(debug).toHaveBeenLastCalledWith('hmr emit dirty=1 resolved=2 emitAll=true pending=2 registration=2 scan=full')
  })

  it('retains a save arriving during the scan and keeps its next profile separate', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.fullEntryScan = true
    const currentProfile = { eventId: 'current' }
    const nextProfile = { eventId: 'next' }
    ctx.runtimeState.build.hmr.profile = currentProfile
    const hook = useLoadEntry(ctx)
    let enter!: () => void
    let resume!: () => void
    const entered = new Promise<void>((resolve) => {
      enter = resolve
    })
    const paused = new Promise<void>((resolve) => {
      resume = resolve
    })
    loader.mockImplementationOnce(async function (this: PluginContext, options, app) {
      enter()
      await paused
      return await emitDiscoveredEntries(['pages/shared.ts']).call(this, options, app)
    })
    hook.markEntryDirty('pages/shared.ts')
    const scan = hook.emitDirtyEntries.call(createPluginContext())
    await entered

    ctx.runtimeState.build.hmr.profile = nextProfile
    hook.markEntryDirty('pages/shared.ts')
    hook.loadedEntrySet.add('pages/shared.ts')
    resume()
    await scan

    expect(hook.dirtyEntrySet).toEqual(new Set(['pages/shared.ts']))
    expect(hook.loadedEntrySet.has('pages/shared.ts')).toBe(false)
    expect(currentProfile).toMatchObject({ eventId: 'current', chunkEmitCount: 1 })
    expect(nextProfile).toEqual({ eventId: 'next' })
  })

  it('does not report a failed complete scan as a successful emission', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.fullEntryScan = true
    const hook = useLoadEntry(ctx)
    loader.mockRejectedValueOnce(new Error('entry scan failed'))

    await expect(hook.emitDirtyEntries.call(createPluginContext())).rejects.toThrow('entry scan failed')

    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBeUndefined()
    expect(debug).not.toHaveBeenCalledWith(expect.stringContaining('hmr emit '))
  })

  it('keeps targeted emission counts and reasons attached to the generation that started them', async () => {
    const ctx = createContext()
    const currentProfile = { eventId: 'current' }
    const nextProfile = { eventId: 'next', dirtyReasonSummary: ['entry-json-only:1'] }
    ctx.runtimeState.build.hmr.profile = currentProfile
    const hook = useLoadEntry(ctx)
    const entry = 'pages/current.ts'
    hook.resolvedEntryMap.set(entry, { id: entry } as any)
    hook.resolvedEntryMap.set('pages/unrelated.ts', { id: 'pages/unrelated.ts' } as any)
    hook.markEntryDirty(entry)
    let enter!: () => void
    let resume!: () => void
    const entered = new Promise<void>((resolve) => {
      enter = resolve
    })
    const paused = new Promise<void>((resolve) => {
      resume = resolve
    })
    const plugin = createPluginContext()
    plugin.load.mockImplementationOnce(async () => {
      enter()
      await paused
      return null
    })

    const emission = hook.emitDirtyEntries.call(plugin)
    await entered
    ctx.runtimeState.build.hmr.profile = nextProfile
    hook.markEntryDirty(entry)
    resume()
    await emission

    expect(currentProfile).toMatchObject({
      eventId: 'current',
      dirtyCount: 1,
      pendingCount: 1,
      emittedCount: 1,
      chunkEmitCount: 1,
      loadCount: 1,
      entryChunkEmitMs: expect.any(Number),
    })
    expect(nextProfile).toEqual({ eventId: 'next', dirtyReasonSummary: ['entry-json-only:1'] })
    expect(hook.dirtyEntrySet).toEqual(new Set([entry]))
    expect(hook.loadedEntrySet.has(entry)).toBe(false)
    expect(debug).toHaveBeenLastCalledWith('hmr emit dirty=1 resolved=2 emitAll=false pending=1 registration=1')
  })
})
