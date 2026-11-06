import type { CompilerContext } from '../../../../../context'
import type { ResolvedAppShell } from '../../appShell'
import type { CompilationCacheEntry } from './types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../../moduleGraph'
import { captureEntryTopology, hasEntryTopologyChange } from '../../../../../runtime/buildPlugin/entryTopology'
import { createRuntimeState } from '../../../../../runtime/runtimeState'
import * as uniApp from '../../../../uniApp'
import { createCompilerAppShellSignature } from '../../appShell'
import { loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev } from './compile'

const mocks = vi.hoisted(() => ({
  compile: vi.fn(async (_source: string, _filename: string, _options: unknown) => ({ script: 'Page({})', template: '<view>refreshed</view>' })),
  read: vi.fn(),
}))

vi.mock('wevu/compiler', async importOriginal => ({
  ...await importOriginal<typeof import('wevu/compiler')>(),
  compileVueFile: mocks.compile,
}))

vi.mock('../../../../utils/sourceSnapshot', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../utils/sourceSnapshot')>(),
  readCompilerInput: mocks.read,
}))
vi.mock('../../pageLayout', async importOriginal => ({
  ...await importOriginal<typeof import('../../pageLayout')>(),
  resolvePageLayoutPlan: async () => undefined,
}))
vi.mock('../../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: async () => ({ transformed: false }),
}))

const source = '<template><view>page</view></template>'

describe('bundle page cache app shell inputs', () => {
  let root: string
  let filename: string
  let shell: ResolvedAppShell

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'weapp-shell-cache-'))
    filename = path.join(root, 'pages/index/index.vue')
    shell = {
      file: path.join(root, '__weapp_vite_app_shell'),
      importPath: '/__weapp_vite_app_shell',
      tagName: 'weapp-app-shell',
    }
    mocks.compile.mockClear()
    mocks.read.mockResolvedValue(source)
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  function refresh(cached: CompilationCacheEntry, appShell?: ResolvedAppShell) {
    return refreshCompiledVueEntryCacheInDev({
      filename,
      cached,
      appShell,
      ctx: {
        moduleGraphService: createModuleGraphService(),
        runtimeState: createRuntimeState(),
      } as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        weappViteConfig: {},
      } as NonNullable<CompilerContext['configService']>,
      compileOptionsState: {
        reExportResolutionCache: new Map(),
        classStyleRuntimeWarned: { value: false },
      },
    })
  }

  it('reuses a current generation validation while still invalidating app shell changes', async () => {
    const runtimeState = createRuntimeState()
    const cached: CompilationCacheEntry = {
      result: { script: 'Page({})', template: '<view>validated</view>' },
      source,
      isPage: true,
      appShellSignature: createCompilerAppShellSignature(undefined),
    }
    const validatedCompilations = new WeakSet([cached.result])
    const options = {
      filename,
      cached,
      validatedCompilations,
      ctx: { moduleGraphService: createModuleGraphService(), runtimeState } as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        weappViteConfig: {},
      } as NonNullable<CompilerContext['configService']>,
      compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
    }
    mocks.read.mockClear()

    expect(await refreshCompiledVueEntryCacheInDev(options)).toBe(cached.result)
    expect(mocks.read).not.toHaveBeenCalled()
    expect(runtimeState.build.hmr.profile.vueBundleCacheHitCount).toBe(1)

    await refreshCompiledVueEntryCacheInDev({ ...options, appShell: shell })
    expect(mocks.read).toHaveBeenCalledTimes(1)
    expect(mocks.compile).toHaveBeenCalledTimes(1)
    expect(runtimeState.build.hmr.profile.vueBundleRecompileCount).toBe(1)
  })

  it.each(['new-generation', 'dirty', 'invalidated'] as const)('rechecks cached source after %s', async (change) => {
    const runtimeState = createRuntimeState()
    const cached: CompilationCacheEntry = {
      result: { script: 'Page({})', template: '<view>validated</view>' },
      source: change === 'invalidated' ? undefined : source,
      isPage: true,
      appShellSignature: createCompilerAppShellSignature(undefined),
    }
    if (change === 'dirty') {
      runtimeState.build.hmr.dirtyVueEntryIds.add(filename)
    }
    mocks.read.mockClear()
    await refreshCompiledVueEntryCacheInDev({
      filename,
      cached,
      validatedCompilations: new WeakSet(change === 'new-generation' ? [] : [cached.result]),
      ctx: { moduleGraphService: createModuleGraphService(), runtimeState } as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        weappViteConfig: {},
      } as NonNullable<CompilerContext['configService']>,
      compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
    })
    expect(mocks.read).toHaveBeenCalledTimes(1)
    expect(mocks.compile).toHaveBeenCalledTimes(change === 'invalidated' ? 1 : 0)
  })

  it.each(['refresh', 'fallback'] as const)('prepares uni-app conditions before %s compilation', async (entry) => {
    const rawSource = `<template>
<!-- #ifdef MP-WEIXIN -->
<view>wechat-only</view>
<!-- #endif -->
<!-- #ifndef MP-WEIXIN -->
<Child><template #default="{ value }">{{ value }}</template></Child>
<!-- #endif -->
</template>
<script>
import Child from './Child.vue'
export default { components: { Child } }
</script>`
    mocks.read.mockResolvedValue(rawSource)
    const options = {
      ctx: { moduleGraphService: createModuleGraphService(), runtimeState: createRuntimeState() } as CompilerContext,
      pluginCtx: { emitFile: vi.fn() },
      configService: {
        isDev: true,
        platform: 'weapp',
        absoluteSrcRoot: root,
        relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
        weappViteConfig: { uniApp: { include: [] } },
      } as unknown as NonNullable<CompilerContext['configService']>,
      compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
    }
    if (entry === 'refresh') {
      await refreshCompiledVueEntryCacheInDev({
        ...options,
        filename,
        cached: { result: { script: 'Page({})' }, isPage: true },
      })
    }
    else {
      await loadFallbackPageEntryCompilation({ ...options, entryFilePath: filename })
    }

    expect(mocks.compile).toHaveBeenCalledTimes(1)
    const compiledSource = mocks.compile.mock.calls[0]?.[0]
    expect(compiledSource).toContain('<view>wechat-only</view>')
    expect(compiledSource).toContain('import Child from \'./Child.vue\'')
    expect(compiledSource).not.toContain('<Child>')
    expect(compiledSource).not.toContain('#default')
  })

  it('keeps app topology on the prepared source before generated auto routes are inlined', async () => {
    filename = path.join(root, 'app.vue')
    const rawSource = `<script setup>
import { pages } from 'weapp-vite/auto-routes'
defineAppJson({ pages })
// #ifndef MP-WEIXIN
defineAppJson({ usingComponents: { hidden: './Hidden.vue' } })
// #endif
</script>`
    mocks.read.mockResolvedValue(rawSource)
    const runtimeState = createRuntimeState()
    runtimeState.build.hmr.resolvedEntryMap.set(filename, { id: filename })
    const configService = {
      isDev: true,
      platform: 'weapp',
      absoluteSrcRoot: root,
      relativeOutputPath: (value: string) => path.relative(root, value).split(path.sep).join('/'),
      weappViteConfig: { uniApp: { include: [] } },
    } as unknown as NonNullable<CompilerContext['configService']>
    const ctx = {
      configService,
      moduleGraphService: createModuleGraphService(),
      runtimeState,
      autoRoutesService: {
        ensureFresh: async () => {},
        getReference: () => ({ pages: [{ path: 'pages/home' }] }),
        getSignature: () => 'current-routes',
      },
    } as unknown as CompilerContext
    const cached: CompilationCacheEntry = { result: { script: 'App({})' }, isPage: false }
    const options = {
      filename,
      cached,
      ctx,
      pluginCtx: { emitFile: vi.fn() },
      configService,
      compileOptionsState: { reExportResolutionCache: new Map(), classStyleRuntimeWarned: { value: false } },
    }

    await refreshCompiledVueEntryCacheInDev(options)

    expect(mocks.compile.mock.calls[0]?.[0]).toContain('pages/home')
    expect(mocks.compile.mock.calls[0]?.[0]).not.toContain('Hidden.vue')
    const committed = captureEntryTopology(ctx)
    expect(await hasEntryTopologyChange(ctx, [filename], committed)).toBe(false)
    await refreshCompiledVueEntryCacheInDev(options)
    expect(mocks.compile).toHaveBeenCalledTimes(1)
    expect(await hasEntryTopologyChange(ctx, [filename], committed)).toBe(false)
  })

  it('propagates compatibility preparation errors instead of publishing historical cache', async () => {
    const failure = new uniApp.UniAppCompatibilityTransformError('invalid input', new Error('parse'))
    const prepare = vi.spyOn(uniApp, 'transformUniAppCompatibilitySource').mockImplementationOnce(() => {
      throw failure
    })
    const cached: CompilationCacheEntry = { result: { template: '<view>historical</view>' }, isPage: true }
    try {
      await expect(refresh(cached)).rejects.toBe(failure)
      expect(mocks.compile).not.toHaveBeenCalled()
    }
    finally {
      prepare.mockRestore()
    }
  })

  it.each(['added', 'removed'])('recompiles an unchanged page when its app shell is %s', async (change) => {
    const previous = change === 'added' ? undefined : shell
    const current = change === 'added' ? shell : undefined
    const cached = {
      result: { script: 'Page({})', template: '<view>cached</view>' },
      source,
      isPage: true,
      appShellSignature: createCompilerAppShellSignature(previous),
    }

    const result = await refresh(cached, current)

    expect(mocks.compile).toHaveBeenCalledTimes(1)
    expect(mocks.compile.mock.calls[0]?.[2]).toMatchObject({
      appShell: current && { importPath: current.importPath, tagName: current.tagName },
    })
    expect(result.template).toBe('<view>refreshed</view>')
    expect(cached.appShellSignature).toBe(createCompilerAppShellSignature(current))

    await refresh(cached, current)
    expect(mocks.compile).toHaveBeenCalledTimes(1)
  })
})
