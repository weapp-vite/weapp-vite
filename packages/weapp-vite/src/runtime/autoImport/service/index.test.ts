import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import { createAutoImportService } from './index'

const getTypedComponentsSettingsMock = vi.hoisted(() => vi.fn(() => ({ enabled: false })))
const getHtmlCustomDataSettingsMock = vi.hoisted(() => vi.fn(() => ({ enabled: false })))
const getVueComponentsSettingsMock = vi.hoisted(() => vi.fn(() => ({ enabled: false })))
const createResolverHelpersMock = vi.hoisted(() => vi.fn())
const createMetadataHelpersMock = vi.hoisted(() => vi.fn())
const createOutputsHelpersMock = vi.hoisted(() => vi.fn())
const createRegistryHelpersMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('../config', () => ({
  DEFAULT_AUTO_IMPORT_MANIFEST_FILENAME: 'components.manifest.json',
  getTypedComponentsSettings: getTypedComponentsSettingsMock,
  getHtmlCustomDataSettings: getHtmlCustomDataSettingsMock,
  getVueComponentsSettings: getVueComponentsSettingsMock,
}))

vi.mock('./resolver', () => ({
  createResolverHelpers: createResolverHelpersMock,
}))

vi.mock('./metadata', () => ({
  createMetadataHelpers: createMetadataHelpersMock,
}))

vi.mock('./outputs', () => ({
  createOutputsHelpers: createOutputsHelpersMock,
}))

vi.mock('./registry', () => ({
  createRegistryHelpers: createRegistryHelpersMock,
}))

vi.mock('../../../context/shared', () => ({
  logger: {
    warn: loggerWarnMock,
  },
}))

function createContext() {
  return {
    runtimeState: createRuntimeState(),
    configService: {
      cwd: '/project',
      currentSubPackageRoot: undefined,
      weappViteConfig: {
        autoImportComponents: {},
      },
    },
  } as any
}

function createResolverHelpers(overrides: Record<string, any> = {}) {
  return {
    collectResolverComponents: vi.fn(() => ({})),
    collectRuntimeResolverComponents: vi.fn(() => ({})),
    clearResolveCache: vi.fn(),
    syncResolverComponentProps: vi.fn(),
    setSupportFileResolverComponents: vi.fn(),
    clearSupportFileResolverComponents: vi.fn(),
    collectStaticResolverComponentsForSupportFiles: vi.fn(() => ({})),
    resolveWithResolvers: vi.fn(),
    resolveNavigationImport: vi.fn(),
    ...overrides,
  }
}

describe('autoImport service index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets runtime state and schedules outputs with settings-aware resolver sync', () => {
    const resolverHelpers = createResolverHelpers()
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    const registryHelpers = {
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue(registryHelpers)
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const ctx = createContext()
    ctx.runtimeState.autoImport.registry.set('CompA', { kind: 'resolver' })
    ctx.runtimeState.autoImport.resolvedResolverComponents.set('van-button', '@vant/weapp/button')
    ctx.runtimeState.autoImport.matcher = () => true
    ctx.runtimeState.autoImport.matcherKey = 'dirty'
    const service = createAutoImportService(ctx)

    service.reset()

    expect(ctx.runtimeState.autoImport.registry.size).toBe(0)
    expect(ctx.runtimeState.autoImport.resolvedResolverComponents.size).toBe(0)
    expect(ctx.runtimeState.autoImport.matcher).toBeUndefined()
    expect(ctx.runtimeState.autoImport.matcherKey).toBe('')
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)
    expect(resolverHelpers.clearResolveCache).toHaveBeenCalledTimes(1)
    expect(resolverHelpers.syncResolverComponentProps).toHaveBeenCalledTimes(2)
  })

  it('batches output scheduling until the bootstrap task completes', async () => {
    const resolverHelpers = createResolverHelpers({
      resolveWithResolvers: vi.fn(() => ({ name: 'TButton', from: 'tdesign-miniprogram/button/button' })),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: true })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const service = createAutoImportService(createContext())

    await service.runInBatch(async () => {
      service.reset()
      service.resolve('TButton')
      service.setSupportFileResolverComponents({
        'van-cell': '@vant/weapp/cell',
      })

      expect(outputsHelpers.scheduleManifestWrite).not.toHaveBeenCalled()
      expect(outputsHelpers.scheduleTypedComponentsWrite).not.toHaveBeenCalled()
      expect(outputsHelpers.scheduleHtmlCustomDataWrite).not.toHaveBeenCalled()
      expect(outputsHelpers.scheduleVueComponentsWrite).not.toHaveBeenCalled()
    })

    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)
  })

  it('resolves local component first, then resolver component and schedules outputs', () => {
    const resolverHelpers = createResolverHelpers({
      resolveWithResolvers: vi
        .fn()
        .mockReturnValueOnce({ name: 'TButton', from: 'tdesign-miniprogram/button/button' })
        .mockReturnValueOnce(undefined),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const ctx = createContext()
    const localMatch = {
      kind: 'local',
      entry: { path: '/project/src/components/local/index.js' },
      value: {
        name: 'LocalComp',
        from: '/components/local/index',
      },
    } as any
    ctx.runtimeState.autoImport.registry.set('LocalComp', localMatch)
    const service = createAutoImportService(ctx)

    expect(service.resolve('LocalComp')).toBe(localMatch)

    expect(service.resolve('TButton')).toEqual({
      kind: 'resolver',
      value: {
        name: 'TButton',
        from: 'tdesign-miniprogram/button/button',
      },
    })
    expect(ctx.runtimeState.autoImport.resolvedResolverComponents.get('TButton')).toBe('tdesign-miniprogram/button/button')
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).not.toHaveBeenCalled()
    expect(service.resolve('NotFound')).toBeUndefined()
  })

  it('removes potential component, filters by matcher and awaits pending writes', async () => {
    const pending = {
      typedResolved: false,
      htmlResolved: false,
      vueResolved: false,
      manifestResolved: false,
    }
    let capturedOutputsState: any
    createResolverHelpersMock.mockReturnValue(createResolverHelpers())
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockImplementation((args: any) => {
      capturedOutputsState = args.outputsState
      return {
        scheduleManifestWrite: vi.fn(),
        scheduleTypedComponentsWrite: vi.fn(),
        scheduleHtmlCustomDataWrite: vi.fn(),
        scheduleVueComponentsWrite: vi.fn(),
      }
    })
    let warnOnce: ((message: string) => void) | undefined
    const ensureMatcher = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce((id: string) => id.endsWith('.vue'))
    const removeRegisteredComponent = vi.fn(() => ({ removed: true, removedNames: ['CompA'] }))
    createRegistryHelpersMock.mockImplementation((args: any) => {
      warnOnce = args.logWarnOnce
      return {
        registerLocalComponent: vi.fn(),
        removeRegisteredComponent,
        ensureMatcher,
      }
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })

    const ctx = createContext()
    const service = createAutoImportService(ctx)

    service.removePotentialComponent('/project/src/components/a.vue')
    expect(removeRegisteredComponent).toHaveBeenCalledWith({
      baseName: '/project/src/components/a',
      templatePath: '/project/src/components/a.vue',
    })

    expect(service.filter('/project/src/pages/index/index.wxml')).toBe(false)
    expect(service.filter('/project/src/pages/index/index.vue')).toBe(true)

    capturedOutputsState.pendingWrite = new Promise<void>((resolve) => {
      pending.manifestResolved = true
      resolve()
    })
    capturedOutputsState.pendingTypedWrite = new Promise<void>((resolve) => {
      pending.typedResolved = true
      resolve()
    })
    capturedOutputsState.pendingHtmlCustomDataWrite = new Promise<void>((resolve) => {
      pending.htmlResolved = true
      resolve()
    })
    capturedOutputsState.pendingVueComponentsWrite = new Promise<void>((resolve) => {
      pending.vueResolved = true
      resolve()
    })

    await service.awaitManifestWrites()
    expect(pending).toEqual({
      typedResolved: true,
      htmlResolved: true,
      vueResolved: true,
      manifestResolved: true,
    })

    warnOnce?.('duplicated warning')
    warnOnce?.('duplicated warning')
    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
  })

  it('handles no-op removals and html-only resolver scheduling', () => {
    const resolverHelpers = createResolverHelpers({
      resolveWithResolvers: vi.fn(() => ({ name: 'TButton', from: 'tdesign-miniprogram/button/button' })),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(() => undefined),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: true })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })

    const ctx = createContext()
    const localMatch = {
      kind: 'local',
      entry: { path: '/project/src/components/local/index.js' },
      value: {
        name: 'LocalComp',
        from: '/components/local/index',
      },
    } as any
    ctx.runtimeState.autoImport.registry.set('LocalComp', localMatch)
    const service = createAutoImportService(ctx)

    service.removePotentialComponent('/project/src/components/noop.vue')
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(false)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(false)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(false)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(false)

    expect(service.resolve('TButton')).toEqual({
      kind: 'resolver',
      value: {
        name: 'TButton',
        from: 'tdesign-miniprogram/button/button',
      },
    })
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).not.toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).not.toHaveBeenCalledWith(true)
    expect(service.getRegisteredLocalComponents()).toEqual([localMatch])
  })

  it('primes support-file resolver components without affecting runtime resolve flow', () => {
    const resolverHelpers = createResolverHelpers({
      collectStaticResolverComponentsForSupportFiles: vi.fn(() => ({ 'van-cell': '@vant/weapp/cell' })),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(() => undefined),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: true })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const service = createAutoImportService(createContext())

    expect(service.collectStaticResolverComponentsForSupportFiles()).toEqual({
      'van-cell': '@vant/weapp/cell',
    })

    service.setSupportFileResolverComponents({
      'van-cell': '@vant/weapp/cell',
    })

    expect(resolverHelpers.setSupportFileResolverComponents).toHaveBeenCalledWith({
      'van-cell': '@vant/weapp/cell',
    })
    expect(resolverHelpers.syncResolverComponentProps).toHaveBeenCalledTimes(2)
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)

    service.clearSupportFileResolverComponents()
    expect(resolverHelpers.clearSupportFileResolverComponents).toHaveBeenCalledTimes(1)
  })

  it('registers potential components and handles resolver metadata branches', async () => {
    let resolverNames: Set<string> | undefined
    createResolverHelpersMock.mockImplementation((args: any) => {
      resolverNames = args.resolverComponentNames
      return createResolverHelpers({
        collectResolverComponents: vi.fn(() => ({ CompA: 'pkg/comp-a' })),
        syncResolverComponentProps: vi.fn(() => {
          resolverNames?.add('CompA')
        }),
        resolveWithResolvers: vi.fn(() => ({ name: 'CompA', from: 'pkg/comp-a' })),
      })
    })
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    const registerLocalComponent = vi.fn(async () => {})
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent,
      removeRegisteredComponent: vi.fn(() => ({ removed: true, removedNames: ['CompA'] })),
      ensureMatcher: vi.fn(() => undefined),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const ctx = createContext()
    const service = createAutoImportService(ctx)

    service.reset()
    outputsHelpers.scheduleManifestWrite.mockClear()
    outputsHelpers.scheduleTypedComponentsWrite.mockClear()
    outputsHelpers.scheduleHtmlCustomDataWrite.mockClear()
    outputsHelpers.scheduleVueComponentsWrite.mockClear()
    await service.registerPotentialComponent('/project/src/components/comp-a.vue')
    expect(registerLocalComponent).toHaveBeenCalledWith('/project/src/components/comp-a.vue')

    expect(service.resolve('CompA')).toEqual({
      kind: 'resolver',
      value: {
        name: 'CompA',
        from: 'pkg/comp-a',
      },
    })
    expect(outputsHelpers.scheduleTypedComponentsWrite).not.toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).not.toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)

    service.removePotentialComponent('/project/src/components/comp-a.vue')
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
  })

  it('awaits pending local component registrations', async () => {
    let releaseRegistration: (() => void) | undefined
    const registerLocalComponent = vi.fn(() => new Promise<void>((resolve) => {
      releaseRegistration = resolve
    }))

    createResolverHelpersMock.mockReturnValue(createResolverHelpers())
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue({
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    })
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent,
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(() => undefined),
    })

    const service = createAutoImportService(createContext())
    const registerPromise = service.registerPotentialComponent('/project/src/components/hot-card/index.vue')
    const pendingPromise = service.awaitPendingRegistrations?.()
    await Promise.resolve()

    expect(registerLocalComponent).toHaveBeenCalledWith('/project/src/components/hot-card/index.vue')

    let settled = false
    void pendingPromise?.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    releaseRegistration?.()
    await registerPromise
    await pendingPromise
    expect(settled).toBe(true)
  })

  it('does not reschedule unchanged resolver outputs repeatedly', () => {
    const resolverHelpers = createResolverHelpers({
      collectResolverComponents: vi.fn(() => ({ TButton: 'tdesign-miniprogram/button/button' })),
      resolveWithResolvers: vi.fn(() => ({ name: 'TButton', from: 'tdesign-miniprogram/button/button' })),
    })
    const outputsHelpers = {
      scheduleManifestWrite: vi.fn(),
      scheduleTypedComponentsWrite: vi.fn(),
      scheduleHtmlCustomDataWrite: vi.fn(),
      scheduleVueComponentsWrite: vi.fn(),
    }
    createResolverHelpersMock.mockReturnValue(resolverHelpers)
    createMetadataHelpersMock.mockReturnValue({
      preloadResolverComponentMetadata: vi.fn(),
      getComponentMetadata: vi.fn(),
    })
    createOutputsHelpersMock.mockReturnValue(outputsHelpers)
    createRegistryHelpersMock.mockReturnValue({
      registerLocalComponent: vi.fn(),
      removeRegisteredComponent: vi.fn(() => ({ removed: false, removedNames: [] })),
      ensureMatcher: vi.fn(),
    })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: true })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const service = createAutoImportService(createContext())

    expect(service.resolve('TButton')).toEqual({
      kind: 'resolver',
      value: {
        name: 'TButton',
        from: 'tdesign-miniprogram/button/button',
      },
    })
    expect(service.resolve('TButton')).toEqual({
      kind: 'resolver',
      value: {
        name: 'TButton',
        from: 'tdesign-miniprogram/button/button',
      },
    })

    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledTimes(1)
    expect(outputsHelpers.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)
  })
})
