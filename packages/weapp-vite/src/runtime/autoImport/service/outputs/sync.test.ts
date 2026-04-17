import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLayoutTypesDefaultPath } from '../../config/base'
import { syncHtmlCustomData, syncTypedComponentsDefinition, syncVueComponentsDefinition } from './sync'

const fsRemoveMock = vi.hoisted(() => vi.fn())
const fsOutputFileMock = vi.hoisted(() => vi.fn())
const fsReaddirMock = vi.hoisted(() => vi.fn())
const fsStatMock = vi.hoisted(() => vi.fn())
const fsReadFileMock = vi.hoisted(() => vi.fn())
const fsReadJsonMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const getTypedComponentsSettingsMock = vi.hoisted(() => vi.fn())
const createTypedComponentsDefinitionMock = vi.hoisted(() => vi.fn())
const createVueComponentsDefinitionMock = vi.hoisted(() => vi.fn())
const createLayoutTypesDefinitionMock = vi.hoisted(() => vi.fn())
const createHtmlCustomDataDefinitionMock = vi.hoisted(() => vi.fn())
const loadWeappBuiltinHtmlTagsMock = vi.hoisted(() => vi.fn())
const collectAllComponentNamesMock = vi.hoisted(() => vi.fn())
const extractComponentPropsMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      remove: fsRemoveMock,
      outputFile: fsOutputFileMock,
      readdir: fsReaddirMock,
      stat: fsStatMock,
      readFile: fsReadFileMock,
      readJson: fsReadJsonMock,
    },
  }
})

vi.mock('../../../../context/shared', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

vi.mock('../../config', () => ({
  getTypedComponentsSettings: getTypedComponentsSettingsMock,
}))

vi.mock('../../typedDefinition', () => ({
  createTypedComponentsDefinition: createTypedComponentsDefinitionMock,
}))

vi.mock('../../../componentProps', () => ({
  extractComponentProps: extractComponentPropsMock,
}))

vi.mock('../../metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../metadata')>()
  return actual
})

vi.mock('../../vueDefinition', () => ({
  createVueComponentsDefinition: createVueComponentsDefinitionMock,
  createLayoutTypesDefinition: createLayoutTypesDefinitionMock,
}))

vi.mock('../../htmlCustomData', () => ({
  createHtmlCustomDataDefinition: createHtmlCustomDataDefinitionMock,
}))

vi.mock('../../weappBuiltinHtmlTags', () => ({
  loadWeappBuiltinHtmlTags: loadWeappBuiltinHtmlTagsMock,
}))

vi.mock('./manifest', () => ({
  collectAllComponentNames: collectAllComponentNamesMock,
}))

function createOutputsState() {
  return {
    pendingWrite: undefined,
    writeRequested: false,
    pendingTypedWrite: undefined,
    typedWriteRequested: false,
    lastWrittenTypedDefinition: undefined,
    lastTypedDefinitionOutputPath: undefined,
    pendingHtmlCustomDataWrite: undefined,
    htmlCustomDataWriteRequested: false,
    lastWrittenHtmlCustomData: undefined,
    lastHtmlCustomDataOutputPath: undefined,
    pendingVueComponentsWrite: undefined,
    vueComponentsWriteRequested: false,
    lastWrittenVueComponentsDefinition: undefined,
    lastVueComponentsOutputPath: undefined,
    lastWrittenLayoutTypesDefinition: undefined,
    lastLayoutTypesOutputPath: undefined,
    lastHtmlCustomDataEnabled: false,
    lastHtmlCustomDataOutput: undefined,
    lastTypedComponentsEnabled: false,
    lastTypedComponentsOutput: undefined,
    lastVueComponentsEnabled: false,
    lastVueComponentsOutput: undefined,
    preparedSyncStateVersion: undefined,
    preparedSyncStatePromise: undefined,
  }
}

function createCommonOptions(overrides: Record<string, any> = {}) {
  const base = {
    ctx: {
      configService: {},
    },
    outputsState: createOutputsState(),
    collectResolverComponents: vi.fn(() => ({})),
    registry: new Map<string, any>(),
    componentMetadataMap: new Map<string, any>(),
    manifestCache: new Map<string, string>(),
    getPreparedStateVersion: vi.fn(() => 1),
    syncResolverComponentProps: vi.fn(),
    preloadResolverComponentMetadata: vi.fn(),
    getComponentMetadata: vi.fn(() => ({
      types: new Map<string, string>(),
      docs: new Map<string, string>(),
    })),
  } as Record<string, any>

  return {
    ...base,
    ...overrides,
    ctx: {
      ...base.ctx,
      ...(overrides.ctx ?? {}),
    },
  }
}

describe('autoImport outputs sync helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsRemoveMock.mockResolvedValue(undefined)
    fsOutputFileMock.mockResolvedValue(undefined)
    collectAllComponentNamesMock.mockReturnValue(['CompA', 'CompB'])
    createTypedComponentsDefinitionMock.mockReturnValue('typed-next')
    createVueComponentsDefinitionMock.mockReturnValue('vue-next')
    createLayoutTypesDefinitionMock.mockReturnValue('layout-types-next')
    createHtmlCustomDataDefinitionMock.mockReturnValue('html-next')
    loadWeappBuiltinHtmlTagsMock.mockReturnValue([])
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    fsReaddirMock.mockImplementation(async (dir: string) => {
      const normalized = dir.replaceAll('\\', '/')
      if (normalized.endsWith('/src/layouts')) {
        return ['admin.vue', 'native-shell']
      }
      if (normalized.endsWith('/src/layouts/native-shell')) {
        return ['index.wxml']
      }
      return []
    })
    fsStatMock.mockImplementation(async (target: string) => {
      const normalized = target.replaceAll('\\', '/')
      return {
        isDirectory: () => normalized.endsWith('/native-shell') || normalized.endsWith('/layouts'),
      }
    })
    fsReadFileMock.mockImplementation(async (target: string) => {
      const normalized = target.replaceAll('\\', '/')
      if (normalized.endsWith('/src/layouts/admin.vue')) {
        return `<script setup lang="ts">defineProps<{ sidebar?: boolean; title?: string }>()</script><template><slot /></template>`
      }
      if (normalized.endsWith('/src/layouts/native-shell/index.js')) {
        return `Component({ properties: { title: { type: String }, sidebar: { type: Boolean } } })`
      }
      return ''
    })
    fsReadJsonMock.mockImplementation(async (target: string) => {
      const normalized = target.replaceAll('\\', '/')
      if (normalized.endsWith('/src/layouts/native-shell/index.json')) {
        return {
          component: true,
          properties: {
            title: {
              type: 'String',
            },
            sidebar: {
              type: 'Boolean',
            },
          },
        }
      }
      return {}
    })
    extractComponentPropsMock.mockImplementation((code: string) => {
      if (code.includes('sidebar') || code.includes('title')) {
        return new Map([
          ['sidebar', 'boolean'],
          ['title', 'string'],
        ])
      }
      return new Map()
    })
  })

  it('cleans previous typed output when typed components are disabled', async () => {
    const options = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastTypedDefinitionOutputPath: '/project/types/old.d.ts',
        lastWrittenTypedDefinition: 'typed-old',
      },
    })
    fsRemoveMock.mockRejectedValueOnce(new Error('remove failed'))

    await syncTypedComponentsDefinition({ enabled: false }, options as any)

    expect(fsRemoveMock).toHaveBeenCalledWith('/project/types/old.d.ts')
    expect(options.outputsState.lastTypedDefinitionOutputPath).toBeUndefined()
    expect(options.outputsState.lastWrittenTypedDefinition).toBeUndefined()
  })

  it('skips typed definition write when output content and path do not change', async () => {
    const options = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastWrittenTypedDefinition: 'typed-same',
        lastTypedDefinitionOutputPath: '/project/types/components.d.ts',
      },
    })
    createTypedComponentsDefinitionMock.mockReturnValueOnce('typed-same')

    await syncTypedComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
    }, options as any)

    expect(options.syncResolverComponentProps).toHaveBeenCalledTimes(1)
    expect(options.preloadResolverComponentMetadata).toHaveBeenCalledTimes(1)
    expect(fsOutputFileMock).not.toHaveBeenCalled()
  })

  it('writes typed definition to the new path and removes old output', async () => {
    const options = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastTypedDefinitionOutputPath: '/project/types/old.d.ts',
      },
    })

    await syncTypedComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/new.d.ts',
    }, options as any)

    expect(fsRemoveMock).toHaveBeenCalledWith('/project/types/old.d.ts')
    expect(fsOutputFileMock).toHaveBeenCalledWith('/project/types/new.d.ts', 'typed-next', 'utf8')
    expect(options.outputsState.lastWrittenTypedDefinition).toBe('typed-next')
    expect(options.outputsState.lastTypedDefinitionOutputPath).toBe('/project/types/new.d.ts')
  })

  it('logs typed definition write failure', async () => {
    const options = createCommonOptions()
    fsOutputFileMock.mockRejectedValueOnce('typed failed')

    await syncTypedComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/new.d.ts',
    }, options as any)

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('写入 typed-components.d.ts 失败: typed failed'))
  })

  it('resolves vue component imports from local entries and resolver map', async () => {
    createVueComponentsDefinitionMock.mockImplementationOnce((_names: string[], _meta: unknown, resolveOptions: any) => {
      return JSON.stringify({
        useTypedComponents: resolveOptions.useTypedComponents,
        moduleName: resolveOptions.moduleName,
        localTs: resolveOptions.resolveComponentImport('LocalTs'),
        localVue: resolveOptions.resolveComponentImport('LocalVue'),
        fallbackResolver: resolveOptions.resolveComponentImport('Fallback'),
        resolverOnly: resolveOptions.resolveComponentImport('ResolverOnly'),
        missing: resolveOptions.resolveComponentImport('Missing'),
      })
    })
    getTypedComponentsSettingsMock.mockReturnValueOnce({ enabled: true })

    const resolveNavigationImport = vi.fn((from: string) => `resolved:${from}`)
    const options = createCommonOptions({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
        },
      },
      outputsState: {
        ...createOutputsState(),
        lastVueComponentsOutputPath: '/project/types/old-components.d.ts',
      },
      registry: new Map<string, any>([
        ['LocalTs', { kind: 'local', entry: { path: '/project/src/components/local/index.ts' } }],
        ['LocalVue', { kind: 'local', entry: { path: '/project/src/components/local-vue/index.vue' } }],
        ['Fallback', { kind: 'local', entry: {} }],
      ]),
      resolverComponentsMapRef: {
        value: {
          Fallback: 'resolver/fallback',
          ResolverOnly: 'resolver/only',
        },
      },
      resolveNavigationImport,
    })

    await syncVueComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
      moduleName: 'auto-components',
    }, options as any)

    expect(fsRemoveMock).toHaveBeenCalledWith('/project/types/old-components.d.ts')
    expect(resolveNavigationImport).toHaveBeenCalledWith('resolver/fallback')
    expect(resolveNavigationImport).toHaveBeenCalledWith('resolver/only')
    expect(fsOutputFileMock).toHaveBeenCalledWith(
      '/project/types/components.d.ts',
      expect.stringContaining('"localTs":"../src/components/local/index"'),
      'utf8',
    )
    expect(fsOutputFileMock).toHaveBeenCalledWith(
      '/project/types/components.d.ts',
      expect.stringContaining('"localVue":"../src/components/local-vue/index.vue"'),
      'utf8',
    )
    expect(fsOutputFileMock).toHaveBeenCalledWith(
      '/project/types/components.d.ts',
      expect.stringContaining('"fallbackResolver":"resolved:resolver/fallback"'),
      'utf8',
    )
    expect(fsOutputFileMock).toHaveBeenCalledWith(
      '/project/types/components.d.ts',
      expect.stringContaining('"useTypedComponents":true'),
      'utf8',
    )
    expect(createVueComponentsDefinitionMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Function),
      expect.objectContaining({
        layoutNames: ['admin', 'native-shell'],
        layoutPropsMap: new Map([
          ['admin', new Map([
            ['sidebar', 'boolean'],
            ['title', 'string'],
          ])],
          ['native-shell', new Map([
            ['title', 'string'],
            ['sidebar', 'boolean'],
          ])],
        ]),
      }),
    )
    expect(fsOutputFileMock).toHaveBeenCalledWith(
      expect.stringMatching(/wevu-layouts\.d\.ts$/),
      'layout-types-next',
      'utf8',
    )
    expect(options.outputsState.lastWrittenVueComponentsDefinition).toContain('"moduleName":"auto-components"')
    expect(options.outputsState.lastVueComponentsOutputPath).toBe('/project/types/components.d.ts')
  })

  it('skips vue definition write when output content and path are unchanged', async () => {
    const configService = {
      cwd: '/project',
    }
    const options = createCommonOptions({
      ctx: {
        configService,
      },
      outputsState: {
        ...createOutputsState(),
        lastWrittenVueComponentsDefinition: 'vue-same',
        lastVueComponentsOutputPath: '/project/types/components.d.ts',
        lastWrittenLayoutTypesDefinition: 'layout-types-next',
        lastLayoutTypesOutputPath: resolveLayoutTypesDefaultPath(configService as any),
      },
      resolverComponentsMapRef: { value: {} },
      resolveNavigationImport: vi.fn(),
    })
    createVueComponentsDefinitionMock.mockReturnValueOnce('vue-same')

    await syncVueComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
    }, options as any)

    expect(fsOutputFileMock).not.toHaveBeenCalled()
  })

  it('logs vue definition write failure', async () => {
    const options = createCommonOptions({
      resolverComponentsMapRef: { value: {} },
      resolveNavigationImport: vi.fn(),
    })
    fsOutputFileMock.mockRejectedValueOnce(new Error('vue failed'))

    await syncVueComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
    }, options as any)

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('写入 components.d.ts 失败: vue failed'))
  })

  it('cleans previous vue definition output when vue components are disabled', async () => {
    const options = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastVueComponentsOutputPath: '/project/types/old-components.d.ts',
        lastWrittenVueComponentsDefinition: 'vue-old',
      },
      resolverComponentsMapRef: { value: {} },
      resolveNavigationImport: vi.fn(),
    })
    fsRemoveMock.mockRejectedValueOnce(new Error('remove vue failed'))

    await syncVueComponentsDefinition({ enabled: false }, options as any)

    expect(fsRemoveMock).toHaveBeenCalledWith('/project/types/old-components.d.ts')
    expect(options.outputsState.lastVueComponentsOutputPath).toBeUndefined()
    expect(options.outputsState.lastWrittenVueComponentsDefinition).toBeUndefined()
  })

  it('handles html custom data cleanup, write and error branches', async () => {
    const disabledOptions = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastHtmlCustomDataOutputPath: '/project/types/old.html-data.json',
        lastWrittenHtmlCustomData: 'html-old',
      },
    })
    fsRemoveMock.mockRejectedValueOnce(new Error('remove html failed'))

    await syncHtmlCustomData({ enabled: false }, disabledOptions as any)

    expect(disabledOptions.outputsState.lastHtmlCustomDataOutputPath).toBeUndefined()
    expect(disabledOptions.outputsState.lastWrittenHtmlCustomData).toBeUndefined()

    const writeOptions = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastHtmlCustomDataOutputPath: '/project/types/old.html-data.json',
      },
    })

    await syncHtmlCustomData({
      enabled: true,
      outputPath: '/project/types/mini-program.html-data.json',
    }, writeOptions as any)

    expect(loadWeappBuiltinHtmlTagsMock).toHaveBeenCalledTimes(1)
    expect(fsOutputFileMock).toHaveBeenCalledWith('/project/types/mini-program.html-data.json', 'html-next', 'utf8')
    expect(writeOptions.outputsState.lastWrittenHtmlCustomData).toBe('html-next')
    expect(writeOptions.outputsState.lastHtmlCustomDataOutputPath).toBe('/project/types/mini-program.html-data.json')

    fsOutputFileMock.mockRejectedValueOnce(new Error('html failed'))
    await syncHtmlCustomData({
      enabled: true,
      outputPath: '/project/types/mini-program.html-data.json',
    }, {
      ...createCommonOptions(),
      outputsState: {
        ...createOutputsState(),
        lastHtmlCustomDataOutputPath: '/project/types/old.html-data.json',
      },
    } as any)

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('写入 mini-program.html-data.json 失败: html failed'))
  })

  it('skips html custom data write when output content and path are unchanged', async () => {
    const options = createCommonOptions({
      outputsState: {
        ...createOutputsState(),
        lastWrittenHtmlCustomData: 'html-same',
        lastHtmlCustomDataOutputPath: '/project/types/mini-program.html-data.json',
      },
    })
    createHtmlCustomDataDefinitionMock.mockReturnValueOnce('html-same')

    await syncHtmlCustomData({
      enabled: true,
      outputPath: '/project/types/mini-program.html-data.json',
    }, options as any)

    expect(fsOutputFileMock).not.toHaveBeenCalled()
  })

  it('reuses prepared sync state across typed, html and vue outputs in one flush', async () => {
    const outputsState = createOutputsState()
    const getComponentMetadata = vi.fn(() => ({
      types: new Map<string, string>(),
      docs: new Map<string, string>(),
    }))
    const options = createCommonOptions({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          cwd: '/project',
        },
      },
      outputsState,
      getComponentMetadata,
      resolverComponentsMapRef: { value: {} },
      resolveNavigationImport: vi.fn(),
    })

    await syncTypedComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
    }, options as any)

    await syncHtmlCustomData({
      enabled: true,
      outputPath: '/project/types/mini-program.html-data.json',
    }, options as any)

    await syncVueComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components-vue.d.ts',
    }, options as any)

    expect(options.syncResolverComponentProps).toHaveBeenCalledTimes(1)
    expect(options.preloadResolverComponentMetadata).toHaveBeenCalledTimes(1)
    expect(collectAllComponentNamesMock).toHaveBeenCalledTimes(1)
    expect(getComponentMetadata).toHaveBeenCalledTimes(2)
  })

  it('rebuilds prepared sync state after prepared state version changes', async () => {
    const preparedStateVersion = { value: 1 }
    const outputsState = createOutputsState()
    const getComponentMetadata = vi.fn(() => ({
      types: new Map<string, string>(),
      docs: new Map<string, string>(),
    }))
    const options = createCommonOptions({
      ctx: {
        configService: {
          absoluteSrcRoot: '/project/src',
          cwd: '/project',
        },
      },
      outputsState,
      getPreparedStateVersion: vi.fn(() => preparedStateVersion.value),
      getComponentMetadata,
      resolverComponentsMapRef: { value: {} },
      resolveNavigationImport: vi.fn(),
    })

    await syncTypedComponentsDefinition({
      enabled: true,
      outputPath: '/project/types/components.d.ts',
    }, options as any)

    preparedStateVersion.value = 2

    await syncHtmlCustomData({
      enabled: true,
      outputPath: '/project/types/mini-program.html-data.json',
    }, options as any)

    expect(options.syncResolverComponentProps).toHaveBeenCalledTimes(2)
    expect(options.preloadResolverComponentMetadata).toHaveBeenCalledTimes(2)
    expect(collectAllComponentNamesMock).toHaveBeenCalledTimes(2)
    expect(getComponentMetadata).toHaveBeenCalledTimes(4)
    expect(outputsState.preparedSyncStateVersion).toBe(2)
  })
})
