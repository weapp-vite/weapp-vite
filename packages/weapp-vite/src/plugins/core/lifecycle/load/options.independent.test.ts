import type { RolldownOutput } from 'rolldown'
import type { CompilerContext } from '../../../../context'
import type { SubPackageMetaValue } from '../../../../types'
import type { CorePluginState } from '../../helpers'
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { transformWithOxc } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../moduleGraph/service'
import { createJsonServicePlugin } from '../../../../runtime/jsonPlugin'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { createScanService } from '../../../../runtime/scanPlugin/service'
import { resolveEntryPath } from '../../../../utils/entryResolve'
import { useLoadEntry } from '../../../hooks/useLoadEntry'
import { flushIndependentOutputs } from '../../../outputFinalizer/independent'
import { createOptionsHook } from './options'

// 只隔离主入口的发射边界；扫描、JSON 缓存、候选解析及独立准备/发布均走真实实现。
vi.mock('../../../hooks/useLoadEntry/loadEntry', () => ({
  createEntryLoader: vi.fn(() => Object.assign(vi.fn(async () => ({ code: '' })), { invalidateResolveCache: vi.fn() })),
}))

const temporaryRoots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(fullEntryScan = true, buildTarget: 'app' | 'plugin' = 'app') {
  const root = await mkdtemp(path.join(tmpdir(), 'independent-owner-'))
  temporaryRoots.push(root)
  const src = path.join(root, 'src')
  let timestamp = Date.now()
  const source = async (name: string, content: string) => {
    const file = path.join(src, name)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, content)
    // 确保真实 JSON mtime 缓存可以在不同文件系统精度下观察本次保存。
    const mtime = new Date(timestamp += 1000)
    await utimes(file, mtime, mtime)
    return file
  }
  const manifest = async (pages: string[], roots: string[]) => source('app.json', JSON.stringify({
    pages,
    subPackages: roots.map(packageRoot => ({ root: packageRoot, independent: true, pages: ['pages/detail'] })),
  }))
  await source('app.js', 'App({})')
  await source('pages/first.js', 'Page({})')
  await source('isolated/pages/detail.js', 'export const label = "initial-child"')
  await manifest(['pages/first'], ['isolated'])
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.fullEntryScan = fullEntryScan
  const ctx = {
    runtimeState,
    currentBuildTarget: buildTarget,
    moduleGraphService: createModuleGraphService(),
    configService: {
      options: { cwd: root },
      isDev: true,
      absoluteSrcRoot: src,
      weappViteConfig: {},
      multiPlatform: { enabled: false },
      platform: 'weapp',
      aliasEntries: [],
      packageJson: {},
      outputExtensions: { wxss: '.wxss' },
      relativeAbsoluteSrcRoot: (id: string) => path.relative(src, id),
      relativeOutputPath: (id: string) => path.relative(src, id),
    },
    autoRoutesService: {
      isEnabled: () => false,
      markDirty: vi.fn(),
      ensureFresh: async () => {},
      getSignature: () => 'disabled-routes',
    },
    wxmlService: { scan: vi.fn(), setWxmlComponentsMap: vi.fn(), wxmlComponentsMap: new Map() },
    autoImportService: { resolve: vi.fn() },
  } as unknown as CompilerContext
  createJsonServicePlugin(ctx)
  ctx.scanService = createScanService(ctx)
  const observed: Array<{ root: string, file: string, source: string }> = []
  const buildIndependentBundle = vi.fn(async (packageRoot: string, meta: SubPackageMetaValue): Promise<RolldownOutput> => {
    const result: RolldownOutput = { output: [] }
    for (const entry of meta.entries) {
      const file = await resolveEntryPath(path.join(src, entry))
      if (!file) {
        throw new Error(`Missing child entry: ${entry}`)
      }
      const content = await readFile(file, 'utf8')
      observed.push({ root: packageRoot, file: path.relative(src, file).replaceAll('\\', '/'), source: content })
      const transformed = await transformWithOxc(content, file)
      result.output.push({ type: 'asset', fileName: `${entry}.js`, names: [], originalFileNames: [], source: transformed.code })
    }
    runtimeState.build.independent.outputs.set(packageRoot, result)
    return result
  })
  ctx.buildService = { buildIndependentBundle } as unknown as CompilerContext['buildService']
  const hooks = useLoadEntry(ctx, { buildTarget })
  const state = { ctx, ...hooks, buildTarget } as unknown as CorePluginState
  const plugin = { meta: { watchMode: false }, resolve: vi.fn(async (id: string) => ({ id })) }
  return { ctx, state, hooks, plugin, source, manifest, observed, buildIndependentBundle, options: createOptionsHook(state) }
}

describe('independent preparation stage ownership', () => {
  it('reserves full-scan child preparation for buildStart', async () => {
    const { ctx, hooks, plugin, options, buildIndependentBundle } = await fixture()
    const input: { input?: Record<string, string> } = {}
    await options.call(plugin, input)
    expect(buildIndependentBundle).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.independent.pendingOutputs).toEqual([])
    expect(Object.keys(input.input!)).toEqual(['app'])

    await hooks.emitDirtyEntries.call(plugin as never)
    expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.independent.pendingOutputs).toHaveLength(1)
  })

  it('rereads app.json and independent roots changed after options', async () => {
    const { ctx, hooks, plugin, options, source, manifest, observed, buildIndependentBundle } = await fixture()
    const input: { input?: Record<string, string> } = {}
    await options.call(plugin, input)
    // 完整重扫由 buildStart 重新发现页面，options 不得把即将撤销的页面钉成静态根。
    expect(Object.keys(input.input!)).toEqual(['app'])
    await source('pages/new-page.js', 'Page({})')
    await source('new-package/pages/detail.ts', 'export const label = "new-package-child"')
    await manifest(['pages/new-page'], ['new-package'])

    await hooks.emitDirtyEntries.call(plugin as never)
    expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
    expect(ctx.scanService.appEntry!.json.pages).toEqual(['pages/new-page'])
    expect([...ctx.scanService.independentSubPackageMap.keys()]).toEqual(['new-package'])
    expect(observed).toEqual([{
      root: 'new-package',
      file: 'new-package/pages/detail.ts',
      source: 'export const label = "new-package-child"',
    }])
  })

  it.each(['save', 'candidate'] as const)('reads fresh child %s after options without cached output handoff', async (change) => {
    const { hooks, plugin, options, source, observed, buildIndependentBundle } = await fixture()
    await options.call(plugin, {})
    const extension = change === 'save' ? 'js' : 'ts'
    await source(`isolated/pages/detail.${extension}`, 'export const label = "fresh-child"')

    await hooks.emitDirtyEntries.call(plugin as never)
    expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
    expect(observed).toEqual([{
      root: 'isolated',
      file: `isolated/pages/detail.${extension}`,
      source: 'export const label = "fresh-child"',
    }])
  })

  it('propagates a syntax failure once from the original pending promise during final publication', async () => {
    const { ctx, hooks, plugin, options, source, buildIndependentBundle } = await fixture()
    await options.call(plugin, {})
    await source('isolated/pages/detail.js', 'export const =')
    await hooks.emitDirtyEntries.call(plugin as never)
    const pending = ctx.runtimeState.build.independent.pendingOutputs
    const failure = await pending[0]!.catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
    const emit = vi.fn()

    await expect(flushIndependentOutputs(ctx, undefined, emit)).rejects.toBe(failure)
    expect(ctx.runtimeState.build.independent.pendingOutputs).toEqual([])
    await expect(flushIndependentOutputs(ctx, undefined, emit)).resolves.toBeUndefined()
    expect(emit).not.toHaveBeenCalled()
    expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['app', false],
    ['plugin', true],
  ] as const)('keeps options waiting for child preparation on %s with fullEntryScan=%s', async (target, fullEntryScan) => {
    const { plugin, options, buildIndependentBundle } = await fixture(fullEntryScan, target)
    const originalBuild = buildIndependentBundle.getMockImplementation()!
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    buildIndependentBundle.mockImplementationOnce(async (root, meta) => {
      started.resolve()
      await release.promise
      return await originalBuild(root, meta)
    })
    const input: { input?: Record<string, string> } = {}
    const task = options.call(plugin, input)
    try {
      await Promise.race([
        started.promise,
        task.then(() => {
          throw new Error('Options completed before awaiting its independent build')
        }),
      ])
      expect(input.input).toBeUndefined()
      expect(buildIndependentBundle).toHaveBeenCalledTimes(1)
    }
    finally {
      release.resolve()
      await task
    }
    expect(Object.keys(input.input!)).toEqual(['app', 'pages/first'])
  })

  it('retains independent package static inputs during a main topology scan', async () => {
    const { ctx, state, plugin } = await fixture()
    state.subPackageMeta = { entries: ['isolated/pages/detail'], subPackage: { root: 'isolated', independent: true } } as CorePluginState['subPackageMeta']
    const input: { input?: Record<string, string> } = {}
    await createOptionsHook(state).call(plugin, input)
    expect(Object.keys(input.input!)).toEqual(['isolated/pages/detail'])
    expect(ctx.runtimeState.build.hmr.fullEntryScan).toBe(true)
  })

  it('keeps production watch preparation in each buildStart round', async () => {
    const { ctx, state, hooks, plugin, options, source, observed, buildIndependentBundle } = await fixture(false)
    ctx.configService.isDev = false
    plugin.meta.watchMode = true
    state.resolvedConfig = { build: { watch: {} } } as CorePluginState['resolvedConfig']
    await options.call(plugin, {})
    expect(buildIndependentBundle).not.toHaveBeenCalled()
    await hooks.emitDirtyEntries.call(plugin as never)
    await source('isolated/pages/detail.js', 'export const label = "watch-child"')
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(buildIndependentBundle).toHaveBeenCalledTimes(2)
    expect(observed.at(-1)?.source).toBe('export const label = "watch-child"')
  })
})
