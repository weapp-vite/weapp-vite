import type { CompilerContext } from '../../../../context'
import type { ChangeEvent } from '../../../../types'
import type { VueCompilationCache, VueStyleBlocksCache } from './transformFile/types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVueTransformPlugin } from './index'

const captured = vi.hoisted(() => ({
  compilationCache: undefined as VueCompilationCache | undefined,
  styleBlocksCache: undefined as VueStyleBlocksCache | undefined,
  styleRefreshTokens: undefined as Map<string, number | string> | undefined,
  published: [] as string[],
}))

vi.mock('../appShell', () => ({
  createCompilerAppShellSignature: () => '',
  resolveAppShellForCompilation: async () => undefined,
  isAppVueFile: () => false,
}))

vi.mock('./shared', async importOriginal => ({
  ...await importOriginal<typeof import('./shared')>(),
  preloadNativeLayoutEntries: async () => {},
}))

vi.mock('./transformFile', () => ({
  transformVueLikeFile: async (options: Parameters<typeof import('./transformFile')['transformVueLikeFile']>[0]) => {
    captured.compilationCache = options.compilationCache
    captured.styleBlocksCache = options.styleBlocksCache
    captured.styleRefreshTokens = options.styleRefreshTokens
    options.compilationCache.set(options.id, {
      source: options.code,
      isPage: true,
      result: { script: 'Page({})', template: '<view>cached page</view>', styles: [] },
    })
    options.styleBlocksCache.set(options.id, [])
    options.styleRefreshTokens.set(options.id, 1)
    return { code: 'Page({})', map: null }
  },
}))

vi.mock('../bundle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../bundle')>()
  return {
    ...actual,
    emitVueBundleAssets: async (_bundle: unknown, state: Parameters<typeof actual.resolveVueBundleEmitState>[0]) => {
      captured.published = actual.resolveVueBundleEmitState(state)?.compilationEntries.map(([id]) => id) ?? []
    },
  }
})

function hook<T extends (...args: any[]) => any>(value: T | { handler: T } | undefined): T {
  return typeof value === 'function' ? value : value!.handler
}

describe('Vue snapshot source invalidation', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'weapp-vue-snapshot-'))
    captured.published = []
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function setup() {
    const removed = path.join(root, 'removed.vue')
    const retained = path.join(root, 'retained.vue')
    const changes: Array<{ file: string, event: ChangeEvent }> = []
    const ctx = {
      configService: { isDev: true, absoluteSrcRoot: root },
      scanService: {},
      moduleGraphService: { getPendingChanges: () => changes },
      runtimeState: { build: { hmr: { didEmitAllEntries: true } } },
    } as unknown as CompilerContext
    const plugin = createVueTransformPlugin(ctx)
    for (const file of [removed, retained]) {
      await writeFile(file, '<template><view>cached page</view></template>')
      await hook(plugin.transform).call({} as never, '<template><view>cached page</view></template>', file)
    }
    return { plugin, changes, removed, retained }
  }

  it('retires a deleted SFC before a complete snapshot can publish its cached page assets', async () => {
    const { plugin, changes, removed, retained } = await setup()
    await rm(removed)
    changes.push({ file: removed, event: 'delete' })

    await hook(plugin.buildStart).call({} as never, {} as never)
    await hook(plugin.generateBundle).call({} as never, {} as never, {}, true)

    expect(captured.published).toEqual([retained])
    expect(captured.compilationCache?.has(removed)).toBe(false)
    expect(captured.styleBlocksCache?.has(removed)).toBe(false)
    expect(captured.styleRefreshTokens?.has(removed)).toBe(false)
  })

  it('keeps an atomically recreated SFC available and invalidates its style snapshot', async () => {
    const { plugin, changes, removed, retained } = await setup()
    await rm(removed)
    await writeFile(removed, '<template><view>replacement</view></template>')
    changes.push({ file: removed, event: 'delete' })

    await hook(plugin.buildStart).call({} as never, {} as never)
    await hook(plugin.generateBundle).call({} as never, {} as never, {}, true)

    expect(captured.published).toEqual([removed, retained])
    expect(captured.compilationCache?.get(removed)?.refreshToken).toBe(1)
    expect(captured.styleBlocksCache?.has(removed)).toBe(false)
    expect(captured.styleBlocksCache?.has(retained)).toBe(true)
  })
})
