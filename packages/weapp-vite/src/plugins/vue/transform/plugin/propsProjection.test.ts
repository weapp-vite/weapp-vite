import type { CompilerContext } from '../../../../context'
import type * as TransformModule from './transformFile'
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../../moduleGraph'
import { createRuntimeState } from '../../../../runtime/runtimeState'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { CompilerHmrHost } from '../../../compilerPlugin/hmr'
import { compilerSourceResolutionKey, withCompilerSourceSnapshot } from '../../../utils/sourceSnapshot'
import { refreshCompiledVueEntryCacheInDev } from '../bundle/shared'
import { createVueTransformPlugin } from './index'

type TransformOptions = Parameters<typeof TransformModule.transformVueLikeFile>[0]

const captured = vi.hoisted(() => ({ options: undefined as TransformOptions | undefined }))

vi.mock('./transformFile', async (importOriginal) => {
  const actual = await importOriginal<typeof TransformModule>()
  return {
    ...actual,
    transformVueLikeFile: async (options: TransformOptions) => {
      captured.options = options
      return actual.transformVueLikeFile(options)
    },
  }
})

function hook<T extends (...args: never[]) => unknown>(value: T | { handler: T } | undefined): T {
  return typeof value === 'function' ? value : value!.handler
}

const source = `<script setup>
import { ref } from 'wevu'
import { navProps } from './navProps.ts'
defineProps(navProps)
defineComponentJson({ component: true })
const haveNext = ref(true)
</script><template><button :disabled="!haveNext" /></template>`
const safeProps = 'export const navProps = Object.freeze({ max: Number })'
const conflictingProps = 'export const navProps = Object.freeze({ haveNext: Boolean })'

describe('props analysis dependency invalidation', () => {
  let root: string

  beforeEach(async () => {
    root = normalizeFsResolvedId(await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-props-analysis-'))))
    captured.options = undefined
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  async function setup(files: Record<string, string>, linkedTarget?: string) {
    const sources = new Map<string, string | null>()
    for (const [name, content] of Object.entries({ 'Parent.vue': source, ...files })) {
      const filename = path.join(root, name)
      await mkdir(path.dirname(filename), { recursive: true })
      sources.set(filename, content)
      await writeFile(filename, content)
    }
    const configService = {
      cwd: root,
      absoluteSrcRoot: root,
      isDev: true,
      platform: 'weapp',
      inlineConfig: {},
      outputExtensions: { js: 'js', wxml: 'wxml', wxss: 'wxss', json: 'json' },
      weappLibConfig: { enabled: true },
      weappViteConfig: {},
      relativeOutputPath: (id: string) => path.relative(root, id),
    } as unknown as NonNullable<CompilerContext['configService']>
    const runtimeState = createRuntimeState()
    runtimeState.scan.isDirty = false
    const moduleGraphService = createModuleGraphService()
    const ctx = { configService, runtimeState, moduleGraphService } as unknown as CompilerContext
    const link = path.join(root, 'navProps.ts')
    if (linkedTarget) {
      await symlink(path.join(root, linkedTarget), link, 'file')
    }
    const pluginCtx = {
      addWatchFile: vi.fn(),
      emitFile: vi.fn(() => ''),
      resolve: async (specifier: string, importer?: string) => {
        const id = specifier.startsWith('.') && importer
          ? path.resolve(path.dirname(importer), specifier)
          : specifier
        if (linkedTarget && id === link) {
          return { id: normalizeFsResolvedId(await realpath(link)) }
        }
        return sources.has(id) ? { id } : null
      },
    }
    const plugin = createVueTransformPlugin(ctx)
    const filename = path.join(root, 'Parent.vue')
    const transform = (snapshotSources: ReadonlyMap<string, string | null> = sources, resolutions?: ReadonlyMap<string, string | undefined>) => withCompilerSourceSnapshot(configService, snapshotSources, () => {
      return hook(plugin.transform).call(pluginCtx as never, source, filename)
    }, resolutions)
    await transform()
    const state = captured.options!
    const cached = () => state.compilationCache.get(filename)!
    const refreshBundle = () => withCompilerSourceSnapshot(configService, sources, () => refreshCompiledVueEntryCacheInDev({
      filename,
      cached: cached(),
      ctx,
      pluginCtx,
      configService,
      compileOptionsState: {
        reExportResolutionCache: state.reExportResolutionCache,
        classStyleRuntimeWarned: state.classStyleRuntimeWarned,
        compileOptionsCache: state.compileOptionsCache,
        componentMetaCache: state.componentMetaCache,
        nativeSlotContextCache: state.nativeSlotContextCache,
        emitResolvedComponentEntries: false,
      },
    }))
    function notify(dependency: string, event: 'delete' | 'update' = 'update') {
      for (const owner of moduleGraphService.collectAffectedEntries(dependency)) {
        runtimeState.build.hmr.dirtyVueEntryIds.add(owner)
      }
      runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-json-only:1']
      hook(plugin.watchChange).call(pluginCtx as never, dependency, { event })
    }
    function change(name: string, content: string | null) {
      const dependency = path.join(root, name)
      sources.set(dependency, content)
      notify(dependency, content === null ? 'delete' : 'update')
    }
    return { filename, sources, pluginCtx, ctx, transform, refreshBundle, cached, change, notify, link }
  }

  it.each(['transform', 'bundle'] as const)('refreshes unchanged owners and registration after props edits through %s', async (mode) => {
    const fixture = await setup({ 'navProps.ts': safeProps })
    const refresh = mode === 'transform' ? fixture.transform : fixture.refreshBundle
    const dependency = path.join(root, 'navProps.ts')
    const first = fixture.cached().result
    expect(first.template).toContain('disabled="{{!haveNext}}"')
    expect(first.meta?.propsAnalysisDeps).toContain(dependency)
    expect(fixture.pluginCtx.addWatchFile).toHaveBeenCalledWith(dependency)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(dependency)).toContain(fixture.filename)
    await refresh()
    expect(fixture.cached().result).toBe(first)

    fixture.change('navProps.ts', conflictingProps)
    expect(fixture.cached().source).toBeUndefined()
    await refresh()
    expect(fixture.cached().result.template).not.toContain('disabled="{{!haveNext}}"')
    expect(fixture.cached().result.meta?.templateRegistrationSignature).not.toBe(first.meta?.templateRegistrationSignature)

    fixture.change('navProps.ts', safeProps)
    await refresh()
    expect(fixture.cached().result.template).toBe(first.template)
    expect(fixture.cached().result.meta?.templateRegistrationSignature).toBe(first.meta?.templateRegistrationSignature)
  })

  it('propagates frozen-input removal and recovers the same owner after restoration', async () => {
    const fixture = await setup({ 'navProps.ts': safeProps })
    fixture.change('navProps.ts', null)
    expect(fixture.cached().source).toBeUndefined()
    await expect(fixture.transform()).rejects.toThrow('Source removed from compiler snapshot:')
    fixture.change('navProps.ts', safeProps)
    await fixture.transform()
    expect(fixture.cached().result.template).toContain('disabled="{{!haveNext}}"')
  })

  it('uses pinned props sources and replaces obsolete re-export dependencies', async () => {
    const fixture = await setup({
      'navProps.ts': 'export { navProps } from "./first.ts"',
      'first.ts': safeProps,
      'second.ts': conflictingProps,
    })
    await writeFile(path.join(root, 'first.ts'), conflictingProps)
    fixture.change('first.ts', safeProps)
    await fixture.transform()
    expect(fixture.cached().result.template).toContain('disabled="{{!haveNext}}"')
    fixture.change('navProps.ts', 'export { navProps } from "./second.ts"')
    await fixture.transform()
    expect(fixture.cached().result.template).not.toContain('disabled="{{!haveNext}}"')
    const graph = fixture.ctx.moduleGraphService
    expect(graph.collectAffectedEntries(path.join(root, 'first.ts'))).not.toContain(fixture.filename)
    expect(graph.collectAffectedEntries(path.join(root, 'second.ts'))).toContain(fixture.filename)
  })

  it.each(['alias', 'target'] as const)('re-resolves changed symlink targets after a %s event', async (eventType) => {
    const fixture = await setup({ 'first.ts': safeProps, 'second.ts': conflictingProps }, 'first.ts')
    expect(fixture.cached().result.template).toContain('disabled="{{!haveNext}}"')
    await unlink(fixture.link)
    await symlink(path.join(root, 'second.ts'), fixture.link, 'file')
    const nextTarget = path.join(root, 'second.ts')
    const eventId = eventType === 'alias' ? fixture.link : nextTarget
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(eventId)).toContain(fixture.filename)
    fixture.notify(eventId)
    await fixture.transform()
    expect(fixture.cached().result.template).not.toContain('disabled="{{!haveNext}}"')
    expect(fixture.cached().result.meta?.propsAnalysisDeps).toContain(nextTarget)
    expect(fixture.ctx.moduleGraphService.collectAffectedEntries(path.join(root, 'first.ts'))).not.toContain(fixture.filename)
  })

  it('keeps frozen resolution and alias identity authoritative across a live retarget', async () => {
    const fixture = await setup({ 'first.ts': safeProps, 'second.ts': conflictingProps }, 'first.ts')
    const first = path.join(root, 'first.ts')
    const second = path.join(root, 'second.ts')
    const host = new CompilerHmrHost()
    host.captureRaw(fixture.link, safeProps)
    host.captureRaw(second, conflictingProps)
    host.captureRaw(fixture.filename, source)
    const frozen = host.freeze([])
    const resolutions = new Map([[compilerSourceResolutionKey('./navProps.ts', fixture.filename), first]])
    await unlink(fixture.link)
    await symlink(second, fixture.link, 'file')
    fixture.notify(fixture.link)
    await fixture.transform(frozen.sources, resolutions)
    expect(fixture.cached().result.template).toContain('disabled="{{!haveNext}}"')
    const graph = fixture.ctx.moduleGraphService
    expect(graph.getEntryDependencies(fixture.filename)).toContainEqual({ kind: 'script', sourceId: first })
    expect(graph.getEntryDependencies(fixture.filename)).not.toContainEqual({ kind: 'script', sourceId: second })

    fixture.notify(second)
    await fixture.transform()
    expect(fixture.cached().result.template).not.toContain('disabled="{{!haveNext}}"')
    expect(graph.collectAffectedEntries(first)).not.toContain(fixture.filename)
  })
})
