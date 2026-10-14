import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../../moduleGraph/protocol'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { createConfigService } from '../../../../runtime/config/createConfigService'
import { resolveRealpath } from '../../../../utils/realpathScope'
import { createOptionsHook } from './options'

let root: string

async function source(file: string, code = 'export {}') {
  const target = path.join(root, 'src', file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, code)
  return target
}

function createState(type: 'page' | 'component', entry: string) {
  const usingComponents: Record<string, string> = type === 'component' ? { card: entry } : {}
  const appEntry = {
    path: path.join(root, 'src/app.ts'),
    json: {
      pages: type === 'page' ? [entry] : [],
      usingComponents,
    },
  }
  const ctx = {
    runtimeState: {
      config: {
        defineEnv: {},
        packageManager: { agent: 'pnpm', name: 'pnpm' },
        options: {
          cwd: root,
          srcRoot: 'src',
          isDev: true,
          platform: 'weapp',
          config: { weapp: {} },
        },
      },
      lib: { enabled: false, entries: new Map() },
      build: { independent: { outputs: new Map(), pendingOutputs: [] } },
    },
    scanService: {
      appEntry,
      loadAppEntry: async () => appEntry,
      loadSubPackages: vi.fn(),
      drainIndependentDirtyRoots: () => [],
      independentSubPackageMap: new Map(),
    },
    buildService: {},
  }
  return {
    ctx: { ...ctx, configService: createConfigService(ctx as any) },
    entriesMap: new Map(),
    hmrRootInputIds: new Set<string>(),
  }
}

async function linkedSources() {
  const first = await source('targets/first/card.ts')
  const second = await source('targets/second/card.ts')
  const link = path.join(root, 'src/entries')
  await symlink(path.dirname(first), link, 'junction')
  return { first, second, link, file: path.join(link, 'card.ts') }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-options-paths-'))
  await source('app.ts', 'App({})')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

describe('logical input synchronous path scope', () => {
  it.each(['page', 'component'] as const)('resolves a %s source once while registering its identities and output paths', async (type) => {
    const entry = 'entries/card.ts'
    const file = await source(entry)
    const state = createState(type, entry)
    const options: { input?: Record<string, string> } = {}
    const native = vi.spyOn(realpathSync, 'native')

    await createOptionsHook(state as any)(options)

    const calls = native.mock.calls.map(([input]) => input)
    expect(calls.filter(input => input === file)).toHaveLength(1)
    expect(calls.filter(input => input === path.join(root, 'src'))).toHaveLength(1)
    expect(calls.filter(input => input === state.ctx.scanService.appEntry.path)).toHaveLength(1)
    expect(options.input).toEqual({
      'app': createLogicalEntryId(state.ctx.scanService.appEntry.path, 'app'),
      'entries/card': createLogicalEntryId(file, type),
    })
    expect([...state.hmrRootInputIds]).toEqual([normalizeSourceId(state.ctx.scanService.appEntry.path), normalizeSourceId(file)])
    expect(state.entriesMap.get('entries/card')).toEqual({ path: file, type })
  })

  it('releases the path scope before resolving the next entry asynchronously', async () => {
    const { first, second, link, file } = await linkedSources()
    const firstDeclaration = await source('first.ts')
    const secondDeclaration = await source('second.ts')
    const state = createState('component', 'first.ts')
    state.ctx.scanService.appEntry.json.usingComponents.next = 'second.ts'
    const options: { input?: Record<string, string> } = {}
    const native = vi.spyOn(realpathSync, 'native')
    const resolve = vi.fn(async (id: string) => {
      if (id === firstDeclaration) {
        return { id: file }
      }
      if (id === secondDeclaration) {
        const previousReads = native.mock.calls.filter(([input]) => input === file).length
        resolveRealpath(file)
        await Promise.resolve()
        resolveRealpath(file)
        expect(native.mock.calls.filter(([input]) => input === file)).toHaveLength(previousReads + 2)
        await unlink(link)
        await symlink(path.dirname(second), link, 'junction')
        return { id: file }
      }
      return { id }
    })

    await createOptionsHook(state as any).call({ resolve }, options)

    const calls = native.mock.calls.map(([input]) => input)
    expect(calls.filter(input => input === file)).toHaveLength(4)
    expect(options.input).toEqual({
      'app': createLogicalEntryId(state.ctx.scanService.appEntry.path, 'app'),
      'targets/first/card': createLogicalEntryId(first, 'component'),
      'targets/second/card': createLogicalEntryId(second, 'component'),
    })
    expect([...state.hmrRootInputIds]).toEqual([
      normalizeSourceId(state.ctx.scanService.appEntry.path),
      normalizeSourceId(first),
      normalizeSourceId(second),
    ])
    expect(state.entriesMap.get('targets/first/card')).toEqual({ path: file, type: 'component' })
    expect(state.entriesMap.get('targets/second/card')).toEqual({ path: file, type: 'component' })
  })

  it('refreshes symlink identity and output mapping for a later options invocation', async () => {
    const { first, second, link, file } = await linkedSources()
    const state = createState('component', 'entries/card.ts')
    const options: { input?: Record<string, string> } = {}
    const optionsHook = createOptionsHook(state as any)

    await optionsHook(options)
    expect(options.input?.['targets/first/card']).toBe(createLogicalEntryId(first, 'component'))

    await unlink(link)
    await symlink(path.dirname(second), link, 'junction')
    state.ctx.configService.options = {
      ...state.ctx.configService.options,
      config: { weapp: { pluginRoot: 'src/targets' } },
      mpDistRoot: 'dist',
      projectConfig: { pluginRoot: 'dist/relocated' },
    }
    const native = vi.spyOn(realpathSync, 'native')
    await optionsHook(options)

    expect(native.mock.calls.filter(([input]) => input === file)).toHaveLength(1)
    expect(options.input).toEqual({
      'app': createLogicalEntryId(state.ctx.scanService.appEntry.path, 'app'),
      'relocated/second/card': createLogicalEntryId(second, 'component'),
    })
    expect([...state.hmrRootInputIds]).toEqual([
      normalizeSourceId(state.ctx.scanService.appEntry.path),
      normalizeSourceId(second),
    ])
    expect(state.entriesMap.get('targets/second/card')).toEqual({ path: file, type: 'component' })
  })

  it('propagates a registration Proxy error and releases already resolved paths', async () => {
    const file = await source('entries/card.ts')
    const state = createState('component', 'entries/card.ts')
    const entries = state.entriesMap
    const error = new Error('entry registration failed')
    state.entriesMap = new Proxy(entries, {
      get(target, property) {
        if (property === 'set') {
          throw error
        }
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const options: { input?: Record<string, string> } = {}
    const native = vi.spyOn(realpathSync, 'native')

    await expect(createOptionsHook(state as any)(options)).rejects.toBe(error)

    expect(entries.size).toBe(0)
    expect(options.input).toBeUndefined()
    const previousReads = native.mock.calls.filter(([input]) => input === file).length
    normalizeSourceId(file)
    normalizeSourceId(file)
    expect(native.mock.calls.filter(([input]) => input === file)).toHaveLength(previousReads + 2)
  })
})
