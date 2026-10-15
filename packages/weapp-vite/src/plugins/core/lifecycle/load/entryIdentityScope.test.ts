import type { CorePluginState } from '../../helpers'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { resolveLoadEntryIdentity } from './entryIdentity'
import { createLoadHook } from './index'

let root: string

async function source(file: string, code = 'export const value = 1') {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, code)
  return target
}

function createState() {
  return {
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        platform: 'weapp',
        pluginOnly: false,
        packageJson: { dependencies: {} },
        weappViteConfig: { autoRoutes: { extensions: [] as string[] } },
        options: {},
        relativeAbsoluteSrcRoot: (id: string) => path.relative(normalizeSourceId(root), normalizeSourceId(id)),
      },
      scanService: {
        appEntry: { path: path.join(root, 'app.ts') },
        pluginJson: { main: '' },
      },
      runtimeState: {
        lib: { enabled: false, entries: new Map() },
        autoRoutes: { pageSourceFiles: new Set<string>() },
        build: { hmr: { profile: {} } },
      },
    },
    subPackageMeta: undefined as { entries: string[] } | undefined,
    hmrRootInputIds: undefined as Set<string> | undefined,
    entriesMap: new Map<string, { path: string, type: 'page' | 'component' }>(),
    loadedEntrySet: new Set<string>(),
    resolvedEntryMap: new Map<string, { id: string }>(),
    loadEntry: vi.fn(async (_id: string, _type: 'app' | 'page' | 'component') => ({ code: 'entry-code' })),
  }
}

function coreState(state: ReturnType<typeof createState>) {
  return state as unknown as CorePluginState
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-entry-scope-'))
  await source('app.ts', 'App({})')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

describe('load entry identity scope', () => {
  it('loads a subpackage-only declaration as a component without claiming its sibling', async () => {
    const entry = await source('sub/pages/foo.vue', '<template><view /></template>')
    const sibling = await source('sub/pages/foo.ts')
    const state = createState()
    state.subPackageMeta = { entries: ['sub/pages/foo'] }
    const load = createLoadHook(coreState(state))

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await expect(load.call({}, entry)).resolves.toEqual({ code: 'entry-code' })
    expect(state.loadEntry).toHaveBeenCalledExactlyOnceWith(entry, 'component')
  })

  it('keeps loadedEntrySet membership independent of physical entry candidates', async () => {
    const entry = await source('components/loaded.ts')
    const ordinary = await source('modules/ordinary.ts')
    const state = createState()
    state.loadedEntrySet.add(entry)
    expect(resolveLoadEntryIdentity(coreState(state), entry).physicalSourceId).toBeUndefined()
    const load = createLoadHook(coreState(state))

    await expect(load.call({}, ordinary)).resolves.toBeUndefined()
    await expect(load.call({}, entry)).resolves.toEqual({ code: 'entry-code' })
    expect(state.loadEntry).toHaveBeenCalledExactlyOnceWith(entry, 'component')
  })

  it.each(['missing', 'empty', 'physical', 'unrelated'] as const)('honors %s plugin root inputs without resolving the host app', async (mode) => {
    const entry = await source('plugin/nested/main.ts')
    const sibling = await source('plugin/nested/main.vue', '<template />')
    const pluginRoot = path.join(root, 'plugin')
    const aliasRoot = path.join(root, 'pluginAlias')
    await symlink(pluginRoot, aliasRoot, 'junction')
    const request = path.join(aliasRoot, 'nested/main.ts')
    const state = createState()
    state.ctx.configService.pluginOnly = true
    state.ctx.configService.relativeAbsoluteSrcRoot = id => path.relative(normalizeSourceId(pluginRoot), normalizeSourceId(id))
    state.ctx.scanService.pluginJson.main = '  nested/main.js  '
    state.hmrRootInputIds = mode === 'missing'
      ? undefined
      : new Set(
          mode === 'physical' ? [normalizeSourceId(entry)] : mode === 'unrelated' ? [normalizeSourceId(sibling)] : [],
        )
    const load = createLoadHook(coreState(state))
    const native = vi.spyOn(realpathSync, 'native')

    if (mode === 'missing' || mode === 'physical') {
      await expect(load.call({}, request)).resolves.toEqual({ code: 'entry-code' })
      expect(state.loadEntry).toHaveBeenCalledExactlyOnceWith(request, 'app')
    }
    else {
      await expect(load.call({}, request)).resolves.toBeUndefined()
      expect(state.loadEntry).not.toHaveBeenCalled()
    }
    if (mode === 'physical') {
      await expect(load.call({}, sibling)).resolves.toBeUndefined()
      expect(state.loadEntry).toHaveBeenCalledTimes(1)
    }
    expect(native.mock.calls.filter(([file]) => file === state.ctx.scanService.appEntry.path)).toHaveLength(0)
  })

  it('reuses successful source lookups only within one synchronous identity operation', async () => {
    const entry = await source('pages/home.ts')
    const physical = normalizeSourceId(entry)
    const state = createState()
    state.entriesMap.set('pages/home', { path: entry, type: 'page' })
    state.ctx.configService.weappViteConfig.autoRoutes.extensions = ['ts']
    state.ctx.runtimeState.autoRoutes.pageSourceFiles.add(entry)
    const native = vi.spyOn(realpathSync, 'native')

    expect(resolveLoadEntryIdentity(coreState(state), entry)).toMatchObject({
      physicalSourceId: physical,
      isSelectedPageSource: true,
      hasPhysicalDeclaration: true,
    })
    expect(native.mock.calls.filter(([file]) => file === entry)).toHaveLength(1)
    expect(resolveLoadEntryIdentity(coreState(state), entry).physicalSourceId).toBe(physical)
    expect(native.mock.calls.filter(([file]) => file === entry)).toHaveLength(2)
  })

  it('does not repeat source identity or inspect the app identity for an ordinary dependency', async () => {
    const ordinary = await source('modules/ordinary.ts')
    const state = createState()
    const load = createLoadHook(coreState(state))
    const native = vi.spyOn(realpathSync, 'native')

    await expect(load.call({}, ordinary)).resolves.toBeUndefined()

    expect(state.loadEntry).not.toHaveBeenCalled()
    expect(native.mock.calls.filter(([file]) => file === ordinary)).toHaveLength(1)
    expect(native.mock.calls.filter(([file]) => file === state.ctx.scanService.appEntry.path)).toHaveLength(0)
  })

  it('refreshes physical identities after a junction is retargeted between operations', async () => {
    const first = normalizeSourceId(await source('first/foo.ts'))
    const second = normalizeSourceId(await source('second/foo.ts'))
    const link = path.join(root, 'workspace')
    await symlink(path.dirname(first), link, 'junction')
    const request = path.join(link, 'foo.ts')
    const state = createState()
    state.ctx.configService.absoluteSrcRoot = link
    state.ctx.configService.relativeAbsoluteSrcRoot = id => path.relative(normalizeSourceId(link), normalizeSourceId(id))
    state.entriesMap.set('foo', { path: 'foo.ts', type: 'page' })

    expect(resolveLoadEntryIdentity(coreState(state), request).physicalSourceId).toBe(first)
    await unlink(link)
    await symlink(path.dirname(second), link, 'junction')
    expect(resolveLoadEntryIdentity(coreState(state), request).physicalSourceId).toBe(second)
  })

  it('retries a missing selected source after it is created behind a junction', async () => {
    const project = path.join(root, 'project')
    const link = path.join(root, 'workspace')
    await mkdir(project)
    await symlink(project, link, 'junction')
    const request = path.join(link, 'later.ts')
    const state = createState()
    state.ctx.configService.weappViteConfig.autoRoutes.extensions = ['ts']
    state.ctx.runtimeState.autoRoutes.pageSourceFiles.add(request)

    expect(resolveLoadEntryIdentity(coreState(state), request).physicalSourceId).toBe(request)
    const physical = normalizeSourceId(await source('project/later.ts'))
    expect(physical).not.toBe(request)
    expect(resolveLoadEntryIdentity(coreState(state), request).physicalSourceId).toBe(physical)
  })

  it('releases the identity scope before calling the asynchronous entry loader', async () => {
    const state = createState()
    const entry = state.ctx.scanService.appEntry.path
    const native = vi.spyOn(realpathSync, 'native')
    const callsForEntry = () => native.mock.calls.filter(([file]) => file === entry).length
    state.loadEntry.mockImplementation(async (id) => {
      const before = callsForEntry()
      normalizeSourceId(id)
      await Promise.resolve()
      normalizeSourceId(id)
      normalizeSourceId(id)
      expect(callsForEntry() - before).toBe(3)
      return { code: 'entry-code' }
    })

    await expect(createLoadHook(coreState(state)).call({}, entry)).resolves.toEqual({ code: 'entry-code' })
    expect(state.loadEntry).toHaveBeenCalledExactlyOnceWith(entry, 'app')
  })
})
