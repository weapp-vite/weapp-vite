import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { createLoadHook } from './index'
import { createOptionsHook } from './options'

let root: string

async function source(file: string, code: string) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, code)
  return target
}

function createState(pages: string[], extensions?: string[]) {
  const appEntry = { path: path.join(root, 'app.ts'), json: { pages } }
  return {
    ctx: {
      configService: {
        absoluteSrcRoot: root,
        isDev: false,
        platform: 'weapp',
        packageJson: { dependencies: {} },
        weappViteConfig: extensions ? { autoRoutes: { extensions } } : {},
        options: {},
        relativeAbsoluteSrcRoot: (id: string) => path.relative(root, id),
        relativeOutputPath: (id: string) => path.relative(root, id),
      },
      scanService: {
        appEntry,
        loadAppEntry: async () => appEntry,
        loadSubPackages: vi.fn(),
        drainIndependentDirtyRoots: () => [],
        independentSubPackageMap: new Map(),
      },
      runtimeState: {
        lib: { enabled: false, entries: new Map() },
        autoRoutes: { pageSourceFiles: new Set<string>() },
        build: { independent: { outputs: new Map(), pendingOutputs: [] }, hmr: { profile: {} } },
      },
      buildService: {},
    },
    entriesMap: new Map(),
    loadedEntrySet: new Set<string>(),
    resolvedEntryMap: new Map(),
    loadEntry: vi.fn(async () => ({ code: 'entry-code' })),
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vite-entry-identity-'))
  await source('app.ts', 'App({})')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('issue #1185: physical entry identity', () => {
  it('keeps explicit Vue components discovered from the same page source as the loader', async () => {
    const page = await source('pages/home/index.vue', '<script setup>import Foo from "../../components/foo/foo.vue"</script>')
    await source('pages/home/index.ts', 'export const pageValue = 1')
    const component = await source('components/foo/foo.vue', '<script setup>import { value } from "./foo.ts"</script>')
    const sibling = await source('components/foo/foo.ts', 'export const value = 1')
    const state = createState(['pages/home/index'])
    const resolve = vi.fn(async (id: string) => ({ id: id.endsWith('/pages/home/index') ? `${id}.ts` : id }))
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any).call({ resolve }, options)

    expect(options.input).toMatchObject({
      'pages/home/index': createLogicalEntryId(page, 'page'),
      'components/foo/foo': createLogicalEntryId(component, 'component'),
    })
    expect(state.entriesMap.get('components/foo/foo')).toMatchObject({ path: component })
    expect(resolve).not.toHaveBeenCalledWith(sibling, expect.anything())

    await source('components/foo/foo.ts', 'export const value = 2')
    await createOptionsHook(state as any).call({ resolve }, options)
    expect(options.input?.['components/foo/foo']).toBe(createLogicalEntryId(component, 'component'))
  })

  it('does not reinterpret explicit script imports as sibling Vue components', async () => {
    const page = await source('pages/home/index.vue', '<script setup>import { value } from "../../components/foo/foo.ts"</script>')
    await source('components/foo/foo.ts', 'export const value = 1')
    await source('components/foo/foo.vue', '<template><view /></template>')
    const state = createState(['pages/home/index'], ['vue'])
    state.ctx.runtimeState.autoRoutes.pageSourceFiles.add(page)
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).not.toHaveProperty('components/foo/foo')
    expect(options.input?.['pages/home/index']).toBe(createLogicalEntryId(page, 'page'))
  })

  it('honors selected native pages and explicitly declared native components', async () => {
    const page = await source('pages/home/index.ts', 'Page({})')
    await source('pages/home/index.vue', '<template><view /></template>')
    const component = await source('components/card/card.ts', 'Component({})')
    await source('components/card/card.vue', '<template><view /></template>')
    const state = createState(['pages/home/index'], ['ts'])
    state.ctx.scanService.appEntry.json = {
      pages: ['pages/home/index'],
      usingComponents: { card: '/components/card/card.ts' },
    } as any
    state.ctx.runtimeState.autoRoutes.pageSourceFiles.add(page)
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input).toMatchObject({
      'pages/home/index': createLogicalEntryId(page, 'page'),
      'components/card/card': createLogicalEntryId(component, 'component'),
    })
  })

  it('keeps named imports and directory barrels on their script identities', async () => {
    await source('pages/home/index.vue', `<script setup>
import Foo from '../../components/foo/foo'
import { value } from '../../modules/value'
import * as barrel from '../../components/barrel'
</script>`)
    const component = await source('components/foo/foo.vue', '<template><view /></template>')
    await source('components/foo/foo.ts', 'export const value = 1')
    await source('modules/value.ts', 'export const value = 2')
    await source('modules/value.vue', '<template><view /></template>')
    await source('components/barrel/index.ts', 'export const value = 3')
    await source('components/barrel/index.vue', '<template><view /></template>')
    const state = createState(['pages/home/index'])
    const options: { input?: Record<string, string> } = {}

    await createOptionsHook(state as any)(options)

    expect(options.input?.['components/foo/foo']).toBe(createLogicalEntryId(component, 'component'))
    expect(Object.keys(options.input!)).toEqual(['app', 'pages/home/index', 'components/foo/foo'])
  })

  it.each(['page', 'component'] as const)('loads the declared %s source without claiming its imported sibling', async (type) => {
    const entry = await source('entries/foo.vue', '<template><view /></template>')
    const sibling = await source('entries/foo.ts', 'export const value = 1')
    const state = createState([])
    state.entriesMap.set('entries/foo', { path: entry, type })
    const load = createLoadHook(state as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await expect(load.call({}, entry)).resolves.toEqual({ code: 'entry-code' })
    expect(state.loadEntry).toHaveBeenCalledWith(entry, type)
    expect(state.entriesMap.get('entries/foo')).toMatchObject({ path: entry, type })
  })

  it('does not claim a subpackage sibling by its extensionless route', async () => {
    const entry = await source('sub/pages/foo.vue', '<template><view /></template>')
    const sibling = await source('sub/pages/foo.ts', 'export const value = 1')
    const state = createState([])
    state.entriesMap.set('sub/pages/foo', { path: entry, type: 'page' })
    const load = createLoadHook({
      ...state,
      subPackageMeta: { entries: ['sub/pages/foo'] },
    } as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'page')
  })

  it('resolves a parent declaration without claiming the child script sibling', async () => {
    const entry = await source('pages/foo.vue', '<template><view /></template>')
    const sibling = await source('pages/foo.ts', 'export const value = 1')
    const state = createState([])
    state.entriesMap.set('pages/foo', { path: state.ctx.scanService.appEntry.path, type: 'page' })
    const load = createLoadHook(state as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'page')
  })

  it('uses the resolved native identity when the declaration still belongs to its parent', async () => {
    const entry = await source('pages/foo.ts', 'Page({})')
    const sibling = await source('pages/foo.vue', '<template><view /></template>')
    const state = createState([])
    state.entriesMap.set('pages/foo', { path: state.ctx.scanService.appEntry.path, type: 'page' })
    state.resolvedEntryMap.set(normalizeSourceId(entry), { id: entry })
    const load = createLoadHook(state as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledTimes(1)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'page')
  })

  it('does not claim the app script sibling as another app entry', async () => {
    const entry = await source('app.vue', '<template><view /></template>')
    const sibling = await source('app.ts', 'export const value = 1')
    const state = createState([])
    state.ctx.scanService.appEntry.path = entry
    const load = createLoadHook(state as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'app')
  })

  it('loads the physical plugin main while retaining the host app scan identity', async () => {
    const entry = await source('plugin/index.ts', 'export const value = 1')
    const sibling = await source('plugin/index.vue', '<template><view /></template>')
    const state = createState([])
    const hostApp = state.ctx.scanService.appEntry.path
    Object.assign(state.ctx.configService, {
      pluginOnly: true,
      relativeAbsoluteSrcRoot: (id: string) => path.relative(path.join(root, 'plugin'), id),
    })
    Object.assign(state.ctx.scanService, {
      pluginJson: { main: 'index.js' },
      pluginJsonPath: path.join(root, 'plugin/plugin.json'),
    })
    const options: { input?: Record<string, string> } = {}
    await createOptionsHook(state as any)(options)
    expect(options.input?.index).toBe(createLogicalEntryId(entry, 'app'))
    expect(state.ctx.scanService.appEntry.path).toBe(hostApp)

    const load = createLoadHook(state as any)
    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledTimes(1)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'app')
  })

  it.each(['page', 'component'] as const)('recognizes a %s declared through a directory junction without claiming its sibling', async (type) => {
    const entry = await source('project/foo.vue', '<template><view /></template>')
    const sibling = await source('project/foo.ts', 'export const value = 1')
    const project = normalizeSourceId(path.join(root, 'project'))
    const workspace = path.join(root, 'workspace')
    await symlink(project, workspace, 'junction')
    const state = createState([])
    Object.assign(state.ctx.configService, {
      absoluteSrcRoot: workspace,
      relativeAbsoluteSrcRoot: (id: string) => path.relative(project, normalizeSourceId(id)),
    })
    state.entriesMap.set('foo', { path: path.join(workspace, 'foo.vue'), type })

    const load = createLoadHook(state as any)
    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    expect(state.loadEntry).not.toHaveBeenCalled()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledExactlyOnceWith(entry, type)
  })

  it('resolves an extensionless declaration with the same default entry semantics', async () => {
    const entry = await source('pages/foo.vue', '<template><view /></template>')
    const sibling = await source('pages/foo.ts', 'export const value = 1')
    const state = createState([])
    state.entriesMap.set('pages/foo', { path: 'pages/foo', type: 'page' })
    const load = createLoadHook(state as any)

    await expect(load.call({}, sibling)).resolves.toBeUndefined()
    await load.call({}, entry)
    expect(state.loadEntry).toHaveBeenCalledTimes(1)
    expect(state.loadEntry).toHaveBeenCalledWith(entry, 'page')
  })
})
