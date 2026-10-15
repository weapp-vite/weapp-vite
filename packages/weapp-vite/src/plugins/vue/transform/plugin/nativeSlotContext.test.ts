import type { CompilerContext } from '../../../../context'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import type * as TransformModule from './transformFile'
import type { VueCompilationCacheEntry } from './transformFile/types'
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { WEVU_NATIVE_DECLARATION_ADDRESS_PROP, WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../moduleGraph'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { CompilerHmrHost } from '../../../compilerPlugin/hmr'
import { compilerSourceResolutionKey, withCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
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

  async function setup(files: Record<string, string>, configure?: (fixture: {
    ctx: CompilerContext
    sources: Map<string, string | null>
  }) => Promise<void>) {
    const sources = new Map<string, string | null>()
    for (const [name, source] of Object.entries(files)) {
      const filename = path.join(root, name)
      await mkdir(path.dirname(filename), { recursive: true })
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
        return typeof sources.get(normalizeFsResolvedId(id)) === 'string' ? { id } : null
      },
    }
    await configure?.({ ctx, sources })
    const plugin = createVueTransformPlugin(ctx)
    const filename = path.join(root, 'Parent.vue')
    const source = files['Parent.vue']!
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
    function change(name: string, nextSource: string | null, dirtyReason = 'entry-script:1') {
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

  it.each([
    ['watch', 'physical', 'directory'],
    ['watch', 'url', 'directory'],
    ['snapshot', 'fs-url', 'directory'],
    ['bundle', 'query', 'directory'],
    ['watch', 'physical', 'leaf file'],
    ['snapshot', 'physical', 'leaf file'],
    ['bundle', 'query', 'leaf file'],
  ] as const)('refreshes linked auto imports through %s using %s change identities with a %s symlink', async (mode, spelling, linkType) => {
    const pure = '<template><text>plain</text></template>'
    const context = '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>'
    const physical = path.join(root, 'real/Child.vue')
    const linked = path.join(root, 'linked/Child.vue')
    const fixture = await setup({
      'Parent.vue': '<template><Child /></template>',
      'real/Child.vue': pure,
    }, async ({ ctx }) => {
      if (linkType === 'leaf file') {
        await mkdir(path.dirname(linked))
        await symlink(physical, linked, 'file')
      }
      else {
        await symlink(path.join(root, 'real'), path.join(root, 'linked'), 'junction')
      }
      // 此 fixture 只实现编译时调用的自动注册服务接口。
      ctx.autoImportService = {
        getVersion: () => 0,
        resolve: () => ({ kind: 'resolver', value: { name: 'Child', from: '/Child', sourceType: 'wevu-sfc', resolvedId: `${linked}?vue` } }),
      } as unknown as CompilerContext['autoImportService']
    })
    expectParticipation(fixture.cached(), false)
    const eventId = spelling === 'url'
      ? `${pathToFileURL(physical).href}?changed`
      : spelling === 'fs-url'
        ? `/@fs/${physical}`
        : spelling === 'query' ? `${physical}?changed` : physical
    for (const next of [context, pure, null, context, pure]) {
      if (next === null) {
        await rm(physical)
      }
      else {
        await writeFile(physical, next)
      }
      fixture.sources.set(physical, next)
      const graph = fixture.ctx.moduleGraphService
      expect(graph.collectAffectedEntries(eventId)).toContain(fixture.filename)
      fixture.ctx.runtimeState.build.hmr.dirtyVueEntryIds.add(fixture.filename)
      fixture.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-style-only:1']
      graph.recordChangedFile(eventId, next === null ? 'delete' : 'update')
      if (mode === 'snapshot') {
        await hook(fixture.plugin.buildStart).call(fixture.pluginCtx as never, {} as never)
      }
      else {
        hook(fixture.plugin.watchChange).call(fixture.pluginCtx as never, eventId, { event: next === null ? 'delete' : 'update' })
      }
      expect(fixture.cached().source).toBeUndefined()
      expect(fixture.cached().styleIndependentSignature).toBeUndefined()
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      expectParticipation(fixture.cached(), next !== pure)
      expect(graph.collectAffectedEntries(eventId)).toContain(fixture.filename)
      graph.clearPendingChanges()
    }
  })

  it.each([
    ['transform', 'directory', 'alias'],
    ['transform', 'directory', 'physical'],
    ['transform', 'leaf', 'alias'],
    ['transform', 'leaf', 'physical'],
    ['bundle', 'directory', 'alias'],
    ['bundle', 'directory', 'physical'],
    ['bundle', 'leaf', 'alias'],
    ['bundle', 'leaf', 'physical'],
    ['transform', 'ordinary', 'alias'],
    ['transform', 'ordinary', 'physical'],
    ['bundle', 'ordinary', 'alias'],
    ['bundle', 'ordinary', 'physical'],
  ] as const)('retargets component aliases through %s with %s links and %s events', async (mode, linkType, eventType) => {
    const linked = path.join(root, 'linked/Child.vue')
    const leaf = linkType !== 'directory'
    const binding = leaf ? linked : path.dirname(linked)
    const fixture = await setup({
      'Parent.vue': '<template><Child /></template>',
      'realA/Child.vue': '<template><text>plain</text></template>',
      'realB/Child.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    }, async ({ ctx }) => {
      if (leaf) {
        await mkdir(path.dirname(linked))
      }
      if (linkType === 'ordinary') {
        await writeFile(linked, '<template><text>plain</text></template>')
      }
      else {
        await symlink(path.join(root, leaf ? 'realA/Child.vue' : 'realA'), binding, leaf ? 'file' : 'junction')
      }
      // 自动导入仍返回同一个 alias，宿主必须观察绑定目标的变化。
      ctx.autoImportService = {
        getVersion: () => 0,
        resolve: () => ({ kind: 'resolver', value: { name: 'Child', from: '/Child', sourceType: 'wevu-sfc', resolvedId: linked } }),
      } as unknown as CompilerContext['autoImportService']
    })
    expectParticipation(fixture.cached(), false)
    for (const target of ['realB', 'realA']) {
      const physical = path.join(root, target, 'Child.vue')
      const previous = path.join(root, target === 'realB' ? 'realA' : 'realB', 'Child.vue')
      await unlink(binding)
      await symlink(leaf ? physical : path.dirname(physical), binding, leaf ? 'file' : 'junction')
      const eventId = eventType === 'alias' ? `${linked}?changed` : physical
      const affected = fixture.ctx.moduleGraphService.collectAffectedEntries(eventId)
      for (const owner of affected) {
        fixture.ctx.runtimeState.build.hmr.dirtyVueEntryIds.add(owner)
      }
      hook(fixture.plugin.watchChange).call(fixture.pluginCtx as never, eventId, { event: 'update' })
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      expectParticipation(fixture.cached(), target === 'realB')
      expect(affected).toContain(fixture.filename)
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(physical)).toContain(fixture.filename)
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(previous)).not.toContain(fixture.filename)
    }
  })

  it.each(['directory', 'leaf'] as const)('keeps frozen alias bindings authoritative after %s link retargeting', async (linkType) => {
    const linked = path.join(root, 'linked/Child.vue')
    const binding = linkType === 'leaf' ? linked : path.dirname(linked)
    const first = path.join(root, 'realA/Child.vue')
    const second = path.join(root, 'realB/Child.vue')
    const fixture = await setup({
      'Parent.vue': '<template><Child /></template>',
      'realA/Child.vue': '<template><text>plain</text></template>',
      'realB/Child.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    }, async ({ ctx }) => {
      if (linkType === 'leaf') {
        await mkdir(path.dirname(linked))
      }
      await symlink(linkType === 'leaf' ? first : path.dirname(first), binding, linkType === 'leaf' ? 'file' : 'junction')
      // 测试只提供自动导入解析接口，其余服务仍由真实宿主 fixture 创建。
      ctx.autoImportService = {
        getVersion: () => 0,
        resolve: () => ({ kind: 'resolver', value: { name: 'Child', from: '/Child', sourceType: 'wevu-sfc', resolvedId: linked } }),
      } as unknown as CompilerContext['autoImportService']
    })
    const host = new CompilerHmrHost()
    host.captureRaw(linked, fixture.sources.get(first)!)
    host.captureRaw(second, fixture.sources.get(second)!)
    host.captureRaw(fixture.filename, fixture.source)
    const frozen = host.freeze([])
    await unlink(binding)
    await symlink(linkType === 'leaf' ? second : path.dirname(second), binding, linkType === 'leaf' ? 'file' : 'junction')
    hook(fixture.plugin.watchChange).call(fixture.pluginCtx as never, second, { event: 'update' })
    await withCompilerSourceSnapshot(fixture.ctx.configService, frozen.sources, async () => {
      await hook(fixture.plugin.transform).call(fixture.pluginCtx as never, fixture.source, fixture.filename)
    })
    expectParticipation(fixture.cached(), false)
    const frozenDependencies = fixture.ctx.moduleGraphService.getEntryDependencies(fixture.filename)
    expect(frozenDependencies).toContainEqual({ kind: 'script', sourceId: first })
    expect(frozenDependencies).not.toContainEqual({ kind: 'script', sourceId: second })
    hook(fixture.plugin.watchChange).call(fixture.pluginCtx as never, second, { event: 'update' })
    await fixture.refreshBundle()
    expectParticipation(fixture.cached(), true)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(first)).not.toContain(fixture.filename)
  })

  it.each([
    ['transform', false],
    ['bundle', false],
    ['transform', true],
    ['bundle', true],
  ] as const)('retargets named barrels through %s with export-star hops=%s', async (mode, transitive) => {
    const parent = '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>'
    const pureExport = 'export { default as Child } from "./Pure.vue"'
    const fixture = await setup({
      'Parent.vue': parent,
      'barrel.ts': transitive ? 'export * from "./middle.ts"' : pureExport,
      'middle.ts': 'export * from "./target.ts"',
      'target.ts': pureExport,
      'Pure.vue': '<template><text>plain</text></template>',
      'Context.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    })
    expectParticipation(fixture.cached(), false)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Pure' } })
    const changed = transitive ? 'target.ts' : 'barrel.ts'
    for (const target of ['Context', 'Pure', 'Context', 'Pure']) {
      const source = `export { default as Child } from "./${target}.vue"`
      await writeFile(path.join(root, changed), source)
      fixture.change(changed, source)
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(path.join(root, changed))).toContain(fixture.filename)
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      expectParticipation(fixture.cached(), target === 'Context')
      expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: `/${target}` } })
      expect(fixture.ctx.runtimeState.build.hmr.externalComponentEntryMap.get(target)).toBe(path.join(root, `${target}.vue`))
    }
  })

  it.each([
    ['transform', false],
    ['bundle', false],
    ['transform', true],
    ['bundle', true],
  ] as const)('retargets named forwarding through %s with renamed exports=%s', async (mode, renamed) => {
    const imported = renamed ? 'Inner' : 'Child'
    const fixture = await setup({
      'Parent.vue': '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>',
      'barrel.ts': `export { ${imported} as Child } from "./middle.ts"`,
      'middle.ts': `export { Selected as ${imported} } from "./target.ts"`,
      'target.ts': 'export { default as Selected } from "./Pure.vue"',
      'Pure.vue': '<template><text>plain</text></template>',
      'Context.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    })
    expectParticipation(fixture.cached(), false)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Pure' } })
    for (const target of ['Context', 'Pure']) {
      const source = `export { default as Selected } from "./${target}.vue"`
      await writeFile(path.join(root, 'target.ts'), source)
      fixture.change('target.ts', source)
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      expectParticipation(fixture.cached(), target === 'Context')
      expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: `/${target}` } })
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(path.join(root, `${target === 'Pure' ? 'Context' : 'Pure'}.vue`))).not.toContain(fixture.filename)
    }
  })

  it.each(['transform', 'bundle'] as const)('retains unknown named forwarding and recovers after cycles through %s', async (mode) => {
    const fixture = await setup({
      'Parent.vue': '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>',
      'barrel.ts': 'export { Inner as Child } from "./middle.ts"',
      'middle.ts': 'export { default as Inner } from "./Pure.vue"',
      'Pure.vue': '<template><text>plain</text></template>',
    })
    for (const source of ['export { Child as Inner } from "./barrel.ts"', 'export {}', 'export { default as Inner } from "./Pure.vue"']) {
      fixture.change('middle.ts', source)
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      const resolved = source.includes('Pure.vue')
      expect(fixture.cached().result.script?.includes(WEVU_NATIVE_SLOT_CONTEXT_KEY)).toBe(!resolved)
      expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: resolved ? '/Pure' : '/barrel' } })
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(path.join(root, 'middle.ts'))).toContain(fixture.filename)
    }
  })

  it('uses frozen named forwarding sources and mappings throughout the chain', async () => {
    const fixture = await setup({
      'Parent.vue': '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>',
      'barrel.ts': 'export { Inner as Child } from "./middle.ts"',
      'middle.ts': 'export { default as Inner } from "./Pure.vue"',
      'Pure.vue': '<template><text>plain</text></template>',
      'Context.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    }, async ({ sources }) => {
      sources.set(path.join(root, 'middle.ts'), 'export { default as Inner } from "./Context.vue"')
    })
    expectParticipation(fixture.cached(), true)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Context' } })
    fixture.change('middle.ts', 'export { default as Inner } from "./Pure.vue"')
    const resolutions = new Map([
      [compilerSourceResolutionKey('./Pure.vue', path.join(root, 'middle.ts')), path.join(root, 'Context.vue')],
    ])
    await withCompilerSourceSnapshot(fixture.ctx.configService, fixture.sources, async () => {
      await hook(fixture.plugin.transform).call(fixture.pluginCtx as never, fixture.source, fixture.filename)
    }, resolutions)
    expectParticipation(fixture.cached(), true)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Context' } })
  })

  it.each(['transform', 'bundle'] as const)('recovers missing named targets and export-star files through %s', async (mode) => {
    const fixture = await setup({
      'Parent.vue': '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>',
      'barrel.ts': 'export * from "./target.ts"',
      'target.ts': 'export {}',
      'Pure.vue': '<template><text>plain</text></template>',
      'Context.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    })
    const targetFile = path.join(root, 'target.ts')
    for (const target of ['Context', null, 'Pure']) {
      const source = target ? `export { default as Child } from "./${target}.vue"` : null
      if (source === null) {
        await rm(targetFile)
      }
      else {
        await writeFile(targetFile, source)
      }
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(targetFile)).toContain(fixture.filename)
      fixture.change('target.ts', source)
      await (mode === 'bundle' ? fixture.refreshBundle() : fixture.transform())
      if (target) {
        expectParticipation(fixture.cached(), target === 'Context')
        expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: `/${target}` } })
      }
      expect(fixture.ctx.moduleGraphService.collectAffectedEntries(targetFile)).toContain(fixture.filename)
    }
  })

  it('uses frozen barrel sources and resolutions even when disk and the live resolver disagree', async () => {
    const fixture = await setup({
      'Parent.vue': '<script>import { defineComponent } from "wevu"; import { Child } from "./barrel.ts"; export default defineComponent({ components: { Child } })</script><template><Child /></template>',
      'barrel.ts': 'export { default as Child } from "./Pure.vue"',
      'Pure.vue': '<template><text>plain</text></template>',
      'Context.vue': '<script setup>import { inject } from "wevu"; const value = inject("token")</script><template><text>{{ value }}</text></template>',
    }, async ({ sources }) => {
      sources.set(path.join(root, 'barrel.ts'), 'export { default as Child } from "./Context.vue"')
    })
    expectParticipation(fixture.cached(), true)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Context' } })

    fixture.change('barrel.ts', 'export { default as Child } from "./Pure.vue"')
    const resolutions = new Map([
      [compilerSourceResolutionKey('./Pure.vue', path.join(root, 'barrel.ts')), path.join(root, 'Context.vue')],
    ])
    await withCompilerSourceSnapshot(fixture.ctx.configService, fixture.sources, async () => {
      await hook(fixture.plugin.transform).call(fixture.pluginCtx as never, fixture.source, fixture.filename)
    }, resolutions)
    expectParticipation(fixture.cached(), true)
    expect(JSON.parse(fixture.cached().result.config!) as unknown).toMatchObject({ usingComponents: { child: '/Context' } })
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
