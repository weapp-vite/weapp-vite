import type { CompilerContext } from '../../../../context'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import type * as TransformModule from './transformFile'
import type { VueCompilationCacheEntry } from './transformFile/types'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../moduleGraph'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { withCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { loadFallbackPageEntryCompilation, refreshCompiledVueEntryCacheInDev } from '../bundle/shared'
import { createVueTransformPlugin } from './index'

type TransformOptions = Parameters<typeof TransformModule.transformVueLikeFile>[0]

const captured = vi.hoisted(() => ({ options: undefined as TransformOptions | undefined }))

vi.mock('./transformFile', async (importOriginal) => {
  const actual = await importOriginal<typeof TransformModule>()
  return {
    ...actual,
    transformVueLikeFile: async (options: TransformOptions) => {
      captured.options = options
      return await actual.transformVueLikeFile(options)
    },
  }
})

function hook<T extends (...args: never[]) => unknown>(value: T | { handler: T } | undefined): T {
  return typeof value === 'function' ? value : value!.handler
}

function expectParticipation(entry: VueCompilationCacheEntry, required: boolean) {
  expect(entry.result.script?.includes(WEVU_NATIVE_SLOT_CONTEXT_KEY)).toBe(required)
  expect(entry.result.template?.includes(WEVU_NATIVE_DECLARATION_ADDRESS_PROP)).toBe(required)
}

describe('native slot context dependency invalidation', () => {
  let root: string

  beforeEach(async () => {
    root = normalizeFsResolvedId(await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-native-context-'))))
    captured.options = undefined
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function setup(files: Record<string, string>) {
    const sources = new Map<string, string>()
    for (const [name, source] of Object.entries(files)) {
      const filename = path.join(root, name)
      sources.set(filename, source)
      await writeFile(filename, source)
    }
    // 测试只提供真实编译链使用的服务，未调用的宿主服务不参与此 fixture。
    const configService = {
      cwd: root,
      absoluteSrcRoot: root,
      isDev: true,
      platform: 'weapp',
      inlineConfig: {},
      outputExtensions: { js: 'js', wxml: 'wxml', wxss: 'wxss', json: 'json' },
      weappLibConfig: { enabled: true },
      weappViteConfig: { vue: { template: { nativeSlotContext: true, scopedSlotsRequireProps: true, scopedSlotsCompiler: 'off' } } },
      relativeOutputPath: (id: string) => path.relative(root, id),
    } as unknown as CompilerContext['configService']
    const runtimeState = createRuntimeState()
    runtimeState.scan.isDirty = false
    const moduleGraphService = createModuleGraphService()
    // 上述配置和图服务共同组成此编译 fixture 的宿主边界。
    const ctx = { configService, runtimeState, moduleGraphService } as unknown as CompilerContext
    const pluginCtx = {
      addWatchFile: vi.fn(),
      emitFile: vi.fn(() => ''),
      resolve: async (source: string, importer?: string) => {
        const id = source.startsWith('.') && importer
          ? path.resolve(path.dirname(importer), source)
          : source
        return sources.has(id) ? { id } : null
      },
    }
    const plugin = createVueTransformPlugin(ctx)
    const filename = path.join(root, 'Parent.vue')
    const source = sources.get(filename)!
    const transform = () => withCompilerSourceSnapshot(configService, sources, async () => {
      return await hook(plugin.transform).call(pluginCtx as never, source, filename)
    })
    await transform()
    const state = captured.options!
    const cached = () => {
      const entry = state.compilationCache.get(filename)
      expect(entry).toBeDefined()
      return entry!
    }
    const compileOptionsState = {
      reExportResolutionCache: state.reExportResolutionCache,
      classStyleRuntimeWarned: state.classStyleRuntimeWarned,
      compileOptionsCache: state.compileOptionsCache,
      componentMetaCache: state.componentMetaCache,
      nativeSlotContextCache: state.nativeSlotContextCache,
      emitResolvedComponentEntries: false,
    }
    const refreshBundle = () => withCompilerSourceSnapshot(configService, sources, async () => {
      return await refreshCompiledVueEntryCacheInDev({
        filename,
        cached: cached(),
        ctx,
        pluginCtx,
        configService,
        compileOptionsState,
      })
    })
    function change(name: string, nextSource: string, dirtyReason = 'entry-script:1') {
      const dependency = path.join(root, name)
      sources.set(dependency, nextSource)
      for (const entry of moduleGraphService.collectAffectedEntries(dependency)) {
        runtimeState.build.hmr.dirtyVueEntryIds.add(entry)
      }
      runtimeState.build.hmr.profile.dirtyReasonSummary = [dirtyReason]
      hook(plugin.watchChange).call(pluginCtx as never, dependency, { event: 'update' })
    }
    return { ctx, plugin, pluginCtx, filename, source, sources, state, cached, transform, refreshBundle, change, compileOptionsState }
  }

  it.each(['transform', 'bundle'] as const)('recomputes unchanged parents after child, grandchild and helper edits through %s reuse', async (mode) => {
    const files = {
      'Parent.vue': '<script setup>import Child from "./Child.vue"</script><template><Child /></template>',
      'Child.vue': '<script setup>import Grandchild from "./Grandchild.vue"</script><template><Grandchild /></template>',
      'Grandchild.vue': '<script setup>import { useValue } from "./helper.ts"; const value = useValue()</script><template><text>{{ value }}</text></template>',
      'helper.ts': 'export function useValue() { return "plain" }',
    }
    const fixture = await setup(files)
    const refresh = mode === 'transform' ? fixture.transform : fixture.refreshBundle
    const graph = fixture.ctx.moduleGraphService
    expectParticipation(fixture.cached(), false)
    const unchangedResult = fixture.cached().result
    await refresh()
    expect(fixture.cached().result).toBe(unchangedResult)
    for (const name of ['Child.vue', 'Grandchild.vue', 'helper.ts']) {
      const dependency = path.join(root, name)
      expect(fixture.cached().result.meta?.nativeSlotContextDeps).toContain(dependency)
      expect(graph.collectAffectedEntries(dependency)).toContain(fixture.filename)
      expect(fixture.pluginCtx.addWatchFile).toHaveBeenCalledWith(dependency)
    }
    const changedSources = {
      'Child.vue': '<script setup>import { inject } from "wevu"; import Grandchild from "./Grandchild.vue"; const value = inject("token")</script><template><Grandchild />{{ value }}</template>',
      'Grandchild.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
      'helper.ts': 'import { inject } from "wevu"; export function useValue() { return inject("token") }',
    }
    for (const name of ['Child.vue', 'Grandchild.vue', 'helper.ts'] as const) {
      for (const required of [true, false]) {
        fixture.change(name, required ? changedSources[name] : files[name], 'entry-style-only:1')
        expect(fixture.cached().source).toBeUndefined()
        expect(fixture.cached().styleIndependentSignature).toBeUndefined()
        expect(fixture.state.nativeSlotContextCache.has(path.join(root, name))).toBe(false)
        if (mode === 'bundle') {
          graph.replaceEntryDependencies(fixture.filename, 'script', [])
        }
        await refresh()
        expect(fixture.cached().source).toBe(fixture.source)
        expectParticipation(fixture.cached(), required)
        expect(graph.collectAffectedEntries(path.join(root, name))).toContain(fixture.filename)
      }
    }
  })

  it('bypasses JSON-only reuse after a context dependency was invalidated', async () => {
    const fixture = await setup({
      'Parent.vue': '<script setup>import Child from "./Child.vue"; defineComponentJson({ component: true })</script><template><Child /></template>',
      'Child.vue': '<template><text>plain</text></template>',
    })
    expectParticipation(fixture.cached(), false)
    expect(fixture.cached().result.meta?.jsonConfigCache).toBeDefined()
    fixture.change('Child.vue', '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>', 'entry-json-only:1')
    await fixture.transform()
    expectParticipation(fixture.cached(), true)
  })

  it('keeps opaque native source dependencies watched and refreshes their unchanged owner', async () => {
    const fixture = await setup({
      'Parent.vue': '<script setup>import NativeChild from "./NativeChild.js"</script><template><NativeChild /></template>',
      'NativeChild.js': 'Component({ properties: { label: String } })',
    })
    const dependency = path.join(root, 'NativeChild.js')
    expect(fixture.cached().result.meta?.nativeSlotContextDeps).toContain(dependency)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(dependency)).toContain(fixture.filename)
    expect(fixture.pluginCtx.addWatchFile).toHaveBeenCalledWith(dependency)
    const previous = fixture.cached().result
    fixture.change('NativeChild.js', 'Component({ properties: { label: Number } })')
    await fixture.refreshBundle()
    expect(fixture.cached().result).not.toBe(previous)
    expect(fixture.cached().source).toBe(fixture.source)
    expect(fixture.cached().result.meta?.nativeSlotContextDeps).toContain(dependency)
  })

  it('registers fallback compilation dependencies and retires removed descendant edges', async () => {
    const fixture = await setup({
      'Parent.vue': '<script setup>import Child from "./Child.vue"</script><template><Child /></template>',
      'Child.vue': '<template><text>plain</text></template>',
    })
    const dependency = path.join(root, 'Child.vue')
    fixture.ctx.moduleGraphService.removeEntryDependencies(fixture.filename)
    fixture.pluginCtx.addWatchFile.mockClear()
    const fallback = await withCompilerSourceSnapshot(fixture.ctx.configService, fixture.sources, async () => {
      return await loadFallbackPageEntryCompilation({
        entryFilePath: fixture.filename,
        ctx: fixture.ctx,
        pluginCtx: fixture.pluginCtx,
        configService: fixture.ctx.configService,
        compileOptionsState: fixture.compileOptionsState,
      })
    })
    expect(fallback.result.meta?.nativeSlotContextDeps).toContain(dependency)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(dependency)).toContain(fixture.filename)
    expect(fixture.pluginCtx.addWatchFile).toHaveBeenCalledWith(dependency)

    fixture.change('Parent.vue', '<template><text>no children</text></template>')
    await fixture.refreshBundle()
    expect(fixture.cached().result.meta?.nativeSlotContextDeps).not.toContain(dependency)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(dependency)).not.toContain(fixture.filename)
  })

  it.each(['buildStart', 'closeBundle', 'closeWatcher'] as const)('releases analysis facts at %s', async (lifecycle) => {
    const fixture = await setup({
      'Parent.vue': '<script setup>import Child from "./Child.vue"</script><template><Child /></template>',
      'Child.vue': '<template><text>plain</text></template>',
    })
    const cache: NonNullable<CompileVueFileResolvedOptions['nativeSlotContextCache']> = fixture.state.nativeSlotContextCache
    expect(cache.size).toBeGreaterThan(0)
    if (lifecycle === 'buildStart') {
      await hook(fixture.plugin.buildStart).call(fixture.pluginCtx as never, {} as never)
    }
    else {
      await hook(fixture.plugin[lifecycle]).call(fixture.pluginCtx as never)
    }
    expect(cache.size).toBe(0)
  })
})
