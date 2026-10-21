import type { CorePluginState } from '../helpers'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, parseSidecarSourceRequest } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { getHmrRuntimeSession } from '../../../runtime/hmrRuntimeSession'
import { isStatefulHmrBoundary } from '../../../runtime/statefulHmr/boundaries'
import { isSafeJavaScriptPatch } from '../../../runtime/statefulHmr/session'
import { createStatefulHmrSidecarModuleCode } from '../../../runtime/statefulHmr/sidecarPlugin'
import { createLogicalEntryLoadHook } from './logicalEntry'

vi.mock('../../../utils', () => ({
  findCssEntry: vi.fn(async () => ({ path: undefined })),
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: vi.fn(async () => ({ path: undefined })),
  findTemplateEntry: vi.fn(async () => ({ path: undefined })),
  findVueEntry: vi.fn(async () => undefined),
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))
vi.mock('../../utils/cache', () => ({ pathExists: vi.fn(async () => true) }))

function fixture(type: 'app' | 'page' | 'component' | 'layout', externalTemplate = false) {
  const srcRoot = path.join(tmpdir(), 'logical-app-shell-fixture', 'src')
  const sourceId = path.join(srcRoot, `${type}.vue`)
  const templatePath = externalTemplate ? path.join(srcRoot, `${type}.wxml`) : undefined
  const graph = createModuleGraphService()
  const state = {
    resolvedEntryMap: new Map(),
    entriesMap: new Map([[type, { type, path: sourceId, templatePath }]]),
    loadEntry: vi.fn(async () => {
      // useLoadEntry 在读取 app.vue 后先登记自身模板，后续逻辑入口重建必须保留。
      if (type === 'app') {
        graph.replaceEntryDependencies(sourceId, 'template', [sourceId])
      }
    }),
    ctx: {
      configService: {
        absoluteSrcRoot: srcRoot,
        isDev: true,
        platform: 'weapp',
        relativeAbsoluteSrcRoot: (id: string) => path.relative(srcRoot, id),
      },
      moduleGraphService: graph,
      runtimeState: { build: { hmr: { externalComponentEntryMap: new Map() } } },
      wxmlService: { scan: vi.fn(), depsMap: new Map() },
    },
  } as unknown as CorePluginState
  const plugin = { addWatchFile: vi.fn(), resolve: vi.fn(async (id: string) => ({ id })) }
  const load = createLogicalEntryLoadHook(state).bind(plugin as never)
  return { srcRoot, sourceId, templatePath, graph, load, state }
}

describe('app shell logical template ownership', () => {
  it.each(['auto', 'stateful-experimental'] as const)('retires logical HMR accept after %s falls back while preserving requested configuration', async (runtime) => {
    const { state, sourceId, load } = fixture('page')
    state.ctx.configService.weappViteConfig = { hmr: { runtime } } as any
    state.ctx.configService.projectPrivateConfig = { setting: { compileHotReLoad: true } } as any
    const entry = createLogicalEntryId(sourceId, 'page')
    expect((await load(entry))?.code).toContain('import.meta.hot.accept()')
    const session = getHmrRuntimeSession(state.ctx)
    session.requestClassic({ code: 'patch-shape', message: 'registration changed' })
    expect((await load(entry))?.code).not.toContain('import.meta.hot.accept()')
    session.markClassic()
    expect((await load(entry))?.code).not.toContain('import.meta.hot.accept()')
    expect(state.ctx.configService.weappViteConfig.hmr?.runtime).toBe(runtime)
    expect(state.ctx.configService.projectPrivateConfig.setting?.compileHotReLoad).toBe(true)
  })

  it.each([false, true])('retains the app source template edge after logical loading (external template: %s)', async (externalTemplate) => {
    const { sourceId, templatePath, graph, load } = fixture('app', externalTemplate)
    const result = await load(createLogicalEntryId(sourceId, 'app'))
    const templateSources = graph.getEntryDependencies(sourceId).filter(dependency => dependency.kind === 'template').map(dependency => dependency.sourceId)

    expect(templateSources).toContain(sourceId)
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(sourceId, sourceId, 'template')))
    if (templatePath) {
      expect(templateSources).toContain(templatePath)
    }
  })

  it.each([true, false])('carries app template changes from the logical wrapper to an unaccepted sidecar (initial template: %s)', async (hasTemplate) => {
    const { sourceId, srcRoot, load } = fixture('app')
    const logical = await load(createLogicalEntryId(sourceId, 'app'))
    const templateSidecar = createSidecarModuleId(sourceId, sourceId, 'template')
    expect(logical?.code).toContain(JSON.stringify(templateSidecar))
    const sidecar = await load(templateSidecar)
    const importSource = /import ("(?:[^"\\]|\\.)*");/.exec(sidecar?.code ?? '')?.[1]
    expect(importSource).toBeDefined()
    const templateRequest = JSON.parse(importSource!) as string
    expect(parseSidecarSourceRequest(templateRequest)).toMatchObject({ ownerId: sourceId, sourceId, kind: 'template' })
    expect(isStatefulHmrBoundary(templateRequest, srcRoot, [sourceId])).toBe(false)
    expect(isSafeJavaScriptPatch([sourceId], { type: 'Patch', code: 'void 0', filename: 'update.js', changedIds: [templateRequest] })).toBe(false)

    const script = '<script>App({})</script>'
    const template = '<template><view>original shell</view><slot /></template>'
    const original = hasTemplate ? script + template : script
    const before = createStatefulHmrSidecarModuleCode(templateRequest, original)
    const changes = hasTemplate
      ? [original.replace('original shell', 'changed shell'), script]
      : [script + template]
    for (const changed of changes) {
      expect(createStatefulHmrSidecarModuleCode(templateRequest, changed)).not.toBe(before)
    }
  })

  it.each(['page', 'component', 'layout'] as const)('preserves the existing %s script boundary without an app shell template edge', async (type) => {
    const { sourceId, graph, load } = fixture(type)
    const result = await load(createLogicalEntryId(sourceId, type))
    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(sourceId, sourceId, 'script')))
    expect(graph.getEntryDependencies(sourceId)).not.toContainEqual({ kind: 'template', sourceId })
  })
})
