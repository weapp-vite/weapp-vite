import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from '../../../moduleGraph/protocol'
import { createLogicalEntryLoadHook, createLogicalEntryResolveHook } from './logicalEntry'

const findCssEntryMock = vi.hoisted(() => vi.fn())
const pathExistsMock = vi.hoisted(() => vi.fn(async () => true))

vi.mock('../../../utils', () => ({
  findCssEntry: findCssEntryMock,
  findJsEntry: vi.fn(async () => ({ path: undefined })),
  findJsonEntry: vi.fn(async () => ({ path: undefined })),
  findTemplateEntry: vi.fn(async () => ({ path: undefined })),
  findVueEntry: vi.fn(async () => undefined),
  isTemplate: (id: string) => id.endsWith('.wxml'),
}))

vi.mock('../../utils/cache', () => ({ pathExists: pathExistsMock }))

describe('core logical entry lifecycle', () => {
  it('loads the physical entry before expressing sidecars and resolved relations', async () => {
    const sourceId = '/project/src/pages/home/index.ts'
    const templatePath = '/project/src/pages/home/index.wxml'
    const stylePath = '/project/src/pages/home/index.wxss'
    const jsonPath = '/project/src/pages/home/index.json'
    const wxsPath = '/project/src/pages/home/filter.wxs'
    const layoutPath = '/project/src/layouts/default.vue'
    const linkedComponent = '/workspace/ui/card/index.ts'
    findCssEntryMock.mockResolvedValue({ path: stylePath, predictions: [stylePath] })
    const getEntryDependencies = vi.fn(() => [
      { kind: 'layout', sourceId: layoutPath },
    ])
    const load = vi.fn(async () => ({ exports: ['default'] }))
    const staleResolve = vi.fn(async () => {
      throw new Error('不应使用被其他 hook 覆盖的模块图上下文')
    })
    const state = {
      resolvedEntryMap: new Map(),
      loadEntry: vi.fn(async () => undefined),
      entriesMap: new Map([
        ['pages/home/index', {
          json: {
            usingComponents: {
              card: linkedComponent,
            },
          },
          jsonPath,
          templatePath,
          type: 'page',
        }],
      ]),
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          isDev: true,
          relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        },
        moduleGraphService: {
          bindPluginContext: vi.fn(),
          load,
          replaceEntryDependencies: vi.fn(),
          resolve: staleResolve,
          getEntryDependencies,
        },
        runtimeState: {
          build: {
            hmr: {
              externalComponentEntryMap: new Map([
                ['workspace/ui/card/index', linkedComponent],
              ]),
            },
          },
        },
        wxmlService: {
          scan: vi.fn(async () => {}),
          depsMap: new Map([
            [templatePath, new Set([wxsPath])],
          ]),
        },
      },
    } as any
    const pluginCtx = {
      load: vi.fn(async () => ({ code: 'Page({})' })),
      resolve: vi.fn(async (source: string) => source === linkedComponent ? { id: linkedComponent } : null),
    } as any

    const result = await createLogicalEntryLoadHook(state)
      .call(pluginCtx, createLogicalEntryId(sourceId, 'page'))
    const code = result?.code ?? ''

    expect(load).not.toHaveBeenCalled()
    expect(staleResolve).not.toHaveBeenCalled()
    expect(pluginCtx.resolve).toHaveBeenCalledWith(linkedComponent, sourceId)
    expect(state.loadEntry).toHaveBeenCalledWith(sourceId, 'page')
    expect(code).toContain(`import ${JSON.stringify(sourceId)};`)
    expect(code).not.toContain('export default __weappViteLogicalEntry.default;')
    expect(getEntryDependencies).toHaveBeenCalledTimes(1)
    for (const [kind, dependency] of [
      ['template', templatePath],
      ['style', stylePath],
      ['json', jsonPath],
      ['layout', layoutPath],
      ['script', sourceId],
      ['wxs', wxsPath],
      ['using-component', linkedComponent],
    ] as const) {
      expect(code).toContain(JSON.stringify(createSidecarModuleId(sourceId, dependency, kind)))
    }
  })

  it('models a Vue physical source through the script sidecar protocol', async () => {
    const sourceId = '/project/src/pages/home/index.vue'
    findCssEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    const state = {
      resolvedEntryMap: new Map(),
      loadEntry: vi.fn(async () => undefined),
      entriesMap: new Map([['pages/home/index', { type: 'page' }]]),
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          isDev: true,
          relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        },
        moduleGraphService: {
          bindPluginContext: vi.fn(),
          getEntryDependencies: vi.fn(() => []),
          replaceEntryDependencies: vi.fn(),
          resolve: vi.fn(async () => null),
        },
        runtimeState: {
          build: {
            hmr: {
              externalComponentEntryMap: new Map(),
            },
          },
        },
        wxmlService: { depsMap: new Map() },
      },
    } as any

    const result = await createLogicalEntryLoadHook(state)
      .call({} as any, createLogicalEntryId(sourceId, 'page'))

    expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(sourceId, sourceId, 'script')))
  })

  it('resolves virtual protocol ids and sidecar sources through the graph service', async () => {
    const sourceId = '/project/src/app.ts'
    const staleResolve = vi.fn(async () => {
      throw new Error('不应使用被其他 hook 覆盖的模块图上下文')
    })
    const resolve = vi.fn(async (source: string) => ({ id: `/resolved${source}` }))
    const state = {
      ctx: {
        moduleGraphService: {
          bindPluginContext: vi.fn(),
          resolve: staleResolve,
        },
      },
    } as any
    const resolveId = createLogicalEntryResolveHook(state)
    const pluginContext = { resolve } as any
    const logicalId = createLogicalEntryId(sourceId, 'app')
    const sidecarId = createSidecarModuleId(sourceId, '/project/src/app.json', 'json')
    const sidecarSource = createSidecarSourceSpecifier(sourceId, '/project/src/app.json', 'json')

    await expect(resolveId.call(pluginContext, logicalId)).resolves.toEqual({ id: logicalId, moduleSideEffects: 'no-treeshake' })
    await expect(resolveId.call(pluginContext, sidecarId)).resolves.toEqual({ id: sidecarId, moduleSideEffects: 'no-treeshake' })
    await expect(resolveId.call(pluginContext, sidecarSource, logicalId)).resolves.toEqual({
      id: '/resolved/project/src/app.json?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fapp.ts&weapp-vite-sidecar=json&lang.js',
      moduleSideEffects: 'no-treeshake',
    })
    await expect(resolveId.call(pluginContext, sourceId)).resolves.toBeNull()
    expect(staleResolve).not.toHaveBeenCalled()
    expect(resolve).toHaveBeenCalledWith(sidecarSource, logicalId, { skipSelf: true })
  })

  it('registers compiler-emitted components on the first logical load without promoting their dependencies', async () => {
    const sourceId = '/project/src/components/card/index.vue'
    const dependencyId = '/project/src/shared.tsx'
    const createState = () => ({
      resolvedEntryMap: new Map(),
      entriesMap: new Map(),
      loadEntry: vi.fn(async () => undefined),
      ctx: {
        configService: {
          isDev: true,
          platform: 'weapp',
          absoluteSrcRoot: '/project/src',
          relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        },
        moduleGraphService: {
          bindPluginContext: vi.fn(),
          getEntryDependencies: () => [{ kind: 'jsx', sourceId: dependencyId }],
          replaceEntryDependencies: vi.fn(),
        },
      },
    })
    findCssEntryMock.mockResolvedValue({ path: undefined, predictions: [] })
    // 冷启动和后续独立快照都必须以同一逻辑入口作为登记边界。
    for (const state of [createState(), createState()]) {
      const load = createLogicalEntryLoadHook(state as any)
      const id = createLogicalEntryId(sourceId, 'component')
      const result = await load.call({} as any, id)
      expect(result?.code).toContain(JSON.stringify(createSidecarModuleId(sourceId, dependencyId, 'jsx')))
      expect([...state.resolvedEntryMap.keys()]).toEqual([sourceId])
      expect(state.resolvedEntryMap.get(sourceId)).toMatchObject({ id: sourceId })
      const resolved = { id: sourceId, meta: { registration: 'resolver' }, moduleSideEffects: false, external: false }
      state.resolvedEntryMap.set(sourceId, resolved)
      await load.call({} as any, id)
      expect(state.resolvedEntryMap.get(sourceId)).toBe(resolved)
      expect(state.resolvedEntryMap.size).toBe(1)
      await load.call({} as any, createSidecarModuleId(sourceId, dependencyId, 'jsx'))
      expect(state.resolvedEntryMap.size).toBe(1)
    }

    const failedState = createState()
    const error = new Error('component metadata failed')
    failedState.loadEntry.mockRejectedValue(error)
    await expect(createLogicalEntryLoadHook(failedState as any)
      .call({} as any, createLogicalEntryId(sourceId, 'component'))).rejects.toBe(error)
    expect(failedState.resolvedEntryMap.size).toBe(0)
  })
})
