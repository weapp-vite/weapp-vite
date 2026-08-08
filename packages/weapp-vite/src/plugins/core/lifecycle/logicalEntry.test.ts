import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from '../../../moduleGraph/protocol'
import { createLogicalEntryLoadHook, createLogicalEntryResolveHook } from './logicalEntry'

const findCssEntryMock = vi.hoisted(() => vi.fn())
const pathExistsMock = vi.hoisted(() => vi.fn(async () => true))

vi.mock('../../../utils', async () => {
  const actual = await vi.importActual<typeof import('../../../utils')>('../../../utils')
  return {
    ...actual,
    findCssEntry: findCssEntryMock,
  }
})

vi.mock('../../utils/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/cache')>()
  return {
    ...actual,
    pathExists: pathExistsMock,
  }
})

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
      { kind: 'using-component', sourceId: linkedComponent },
    ])
    const load = vi.fn(async () => ({ exports: ['default'] }))
    const resolve = vi.fn(async (source: string) => source === '@ui/card' ? { id: linkedComponent } : null)
    const state = {
      loadEntry: vi.fn(async () => undefined),
      entriesMap: new Map([
        ['pages/home/index', {
          json: {
            usingComponents: {
              card: '@ui/card',
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
          resolve,
          getEntryDependencies,
        },
        runtimeState: {
          build: {
            hmr: {
              externalComponentEntryMap: new Map(),
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
      resolve: vi.fn(async (source: string) => source === '@ui/card' ? { id: linkedComponent } : null),
    } as any

    const result = await createLogicalEntryLoadHook(state)
      .call(pluginCtx, createLogicalEntryId(sourceId, 'page'))
    const code = result?.code ?? ''

    expect(load).not.toHaveBeenCalled()
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
    const resolve = vi.fn(async (source: string) => ({ id: `/resolved${source}` }))
    const state = {
      ctx: {
        moduleGraphService: {
          bindPluginContext: vi.fn(),
          resolve,
        },
      },
    } as any
    const resolveId = createLogicalEntryResolveHook(state)
    const logicalId = createLogicalEntryId(sourceId, 'app')
    const sidecarId = createSidecarModuleId(sourceId, '/project/src/app.json', 'json')
    const sidecarSource = createSidecarSourceSpecifier(sourceId, '/project/src/app.json', 'json')

    await expect(resolveId.call({} as any, logicalId)).resolves.toEqual({ id: logicalId, moduleSideEffects: 'no-treeshake' })
    await expect(resolveId.call({} as any, sidecarId)).resolves.toEqual({ id: sidecarId, moduleSideEffects: 'no-treeshake' })
    await expect(resolveId.call({} as any, sidecarSource, logicalId)).resolves.toEqual({
      id: '/resolved/project/src/app.json?raw&weapp-vite-sidecar-owner=%2Fproject%2Fsrc%2Fapp.ts&weapp-vite-sidecar=json&lang.js',
      moduleSideEffects: 'no-treeshake',
    })
    await expect(resolveId.call({} as any, sourceId)).resolves.toBeNull()
    expect(resolve).toHaveBeenCalledWith(sidecarSource, logicalId, { skipSelf: true })
  })
})
