import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRegistryHelpers } from './registry'

const readFileMock = vi.hoisted(() => vi.fn())
const readJsonMock = vi.hoisted(() => vi.fn())
const pmMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const resolvedComponentNameMock = vi.hoisted(() => vi.fn())
const findJsEntryMock = vi.hoisted(() => vi.fn())
const findJsonEntryMock = vi.hoisted(() => vi.fn())
const findTemplateEntryMock = vi.hoisted(() => vi.fn())
const findVueEntryMock = vi.hoisted(() => vi.fn())
const extractConfigFromVueMock = vi.hoisted(() => vi.fn())
const compileVueFileMock = vi.hoisted(() => vi.fn())
const extractComponentPropsMock = vi.hoisted(() => vi.fn())
const requireConfigServiceMock = vi.hoisted(() => vi.fn())
const getAutoImportConfigMock = vi.hoisted(() => vi.fn())
const getTypedComponentsSettingsMock = vi.hoisted(() => vi.fn())
const getHtmlCustomDataSettingsMock = vi.hoisted(() => vi.fn())
const getVueComponentsSettingsMock = vi.hoisted(() => vi.fn())
const extractJsonPropMetadataMock = vi.hoisted(() => vi.fn())
const mergePropMapsMock = vi.hoisted(() => vi.fn())
const isBuiltinComponentMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-core/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared')>()
  const mockedFs = {
    ...actual.fs,
    readFile: readFileMock,
    readJson: readJsonMock,
  }
  return {
    ...actual,
    fs: mockedFs,
  }
})

vi.mock('picomatch', () => ({
  default: pmMock,
}))

vi.mock('../../../context/shared', () => ({
  logger: {
    error: loggerErrorMock,
  },
  resolvedComponentName: resolvedComponentNameMock,
}))

vi.mock('../../../utils', () => ({
  findJsEntry: findJsEntryMock,
  findJsonEntry: findJsonEntryMock,
  findTemplateEntry: findTemplateEntryMock,
  findVueEntry: findVueEntryMock,
  extractConfigFromVue: extractConfigFromVueMock,
}))

vi.mock('wevu/compiler', () => ({
  compileVueFile: compileVueFileMock,
}))

vi.mock('../../componentProps', () => ({
  extractComponentProps: extractComponentPropsMock,
}))

vi.mock('../../utils/requireConfigService', () => ({
  requireConfigService: requireConfigServiceMock,
}))

vi.mock('../config', () => ({
  getAutoImportConfig: getAutoImportConfigMock,
  getTypedComponentsSettings: getTypedComponentsSettingsMock,
  getHtmlCustomDataSettings: getHtmlCustomDataSettingsMock,
  getVueComponentsSettings: getVueComponentsSettingsMock,
}))

vi.mock('../metadata', () => ({
  extractJsonPropMetadata: extractJsonPropMetadataMock,
  mergePropMaps: mergePropMapsMock,
}))

vi.mock('../../../auto-import-components/builtin', () => ({
  isBuiltinComponent: isBuiltinComponentMock,
}))

function createState() {
  const autoImportState = {
    matcher: undefined as undefined | ((id: string) => boolean),
    matcherKey: '',
  }

  const configService = {
    cwd: '/project',
    relativeCwd: vi.fn((filePath: string) => filePath.replace('/project/', '')),
    relativeSrcRoot: vi.fn((relativePath: string) => relativePath.replace(/^src\//, '')),
    weappViteConfig: {},
  }

  const jsonService = {
    read: vi.fn(async () => ({ component: true })),
  }

  return {
    ctx: {
      configService,
      jsonService,
    },
    registry: new Map<string, any>(),
    autoImportState,
    resolverComponentNames: new Set<string>(),
    componentMetadataMap: new Map<string, any>(),
    logWarnOnce: vi.fn(),
    scheduleManifestWrite: vi.fn(),
    scheduleTypedComponentsWrite: vi.fn(),
    scheduleHtmlCustomDataWrite: vi.fn(),
    scheduleVueComponentsWrite: vi.fn(),
  } as any
}

function createLocalEntry(baseName: string) {
  return {
    kind: 'local',
    value: {
      name: 'Comp',
      from: '/components/comp/index',
    },
    entry: {
      path: `${baseName}.js`,
      json: { component: true },
      jsonPath: `${baseName}.json`,
      type: 'component',
      templatePath: `${baseName}.wxml`,
    },
  }
}

describe('autoImport registry helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    readFileMock.mockResolvedValue('export default {}')
    readJsonMock.mockResolvedValue({ component: true })

    pmMock.mockImplementation(() => {
      return (id: string) => id.endsWith('.vue')
    })

    findJsEntryMock.mockImplementation(async (baseName: string) => ({ path: `${baseName}.js` }))
    findJsonEntryMock.mockImplementation(async (baseName: string) => ({ path: `${baseName}.json` }))
    findTemplateEntryMock.mockImplementation(async (baseName: string) => ({ path: `${baseName}.wxml` }))
    findVueEntryMock.mockResolvedValue(undefined)
    extractConfigFromVueMock.mockResolvedValue(undefined)

    resolvedComponentNameMock.mockReturnValue({
      componentName: 'Comp',
      base: 'index',
    })

    extractComponentPropsMock.mockReturnValue(new Map([['fromScript', 'string']]))
    extractJsonPropMetadataMock.mockReturnValue({
      props: new Map([['fromJson', 'number']]),
      docs: new Map([['fromJson', 'doc']]),
    })
    mergePropMapsMock.mockImplementation((baseProps: Map<string, string>, scriptProps: Map<string, string>) => {
      return new Map([...baseProps, ...scriptProps])
    })

    requireConfigServiceMock.mockImplementation((ctx: any) => ctx.configService)
    getAutoImportConfigMock.mockReturnValue({ globs: ['components/**/*.wxml'] })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })
    isBuiltinComponentMock.mockReturnValue(false)
  })

  it('removes registered local component by template/js/json/baseName', () => {
    const state = createState()
    state.registry.set('CompA', createLocalEntry('/project/src/components/a/index'))
    state.registry.set('CompB', createLocalEntry('/project/src/components/b/index'))
    state.registry.set('ResolverOnly', { kind: 'resolver', value: { name: 'ResolverOnly', from: 'pkg/a' } })

    const helpers = createRegistryHelpers(state)

    expect(helpers.removeRegisteredComponent({ templatePath: '/project/src/components/a/index.wxml' })).toEqual({
      removed: true,
      removedNames: ['CompA'],
    })
    expect(helpers.removeRegisteredComponent({ jsEntry: '/project/src/components/b/index.js' })).toEqual({
      removed: true,
      removedNames: ['CompB'],
    })
    expect(helpers.removeRegisteredComponent({ baseName: '/project/src/components/missing/index' })).toEqual({
      removed: false,
      removedNames: [],
    })
    expect(state.registry.has('ResolverOnly')).toBe(true)
  })

  it('builds and caches matcher by auto import globs', () => {
    const state = createState()
    const helpers = createRegistryHelpers(state)

    getAutoImportConfigMock.mockReturnValueOnce(undefined)
    expect(helpers.ensureMatcher()).toBeUndefined()
    expect(state.autoImportState.matcher).toBeUndefined()
    expect(state.autoImportState.matcherKey).toBe('')

    const firstMatcher = helpers.ensureMatcher()
    expect(firstMatcher?.('/project/src/components/a.vue')).toBe(true)
    expect(pmMock).toHaveBeenCalledTimes(1)

    const cachedMatcher = helpers.ensureMatcher()
    expect(cachedMatcher).toBe(firstMatcher)
    expect(pmMock).toHaveBeenCalledTimes(1)

    getAutoImportConfigMock.mockReturnValue({ globs: ['subpkg/components/**/*.wxml'] })
    const nextMatcher = helpers.ensureMatcher()
    expect(nextMatcher).toBeDefined()
    expect(nextMatcher).not.toBe(firstMatcher)
    expect(pmMock).toHaveBeenCalledTimes(2)
  })

  it('throws when required services are not initialized before registration', async () => {
    const stateWithoutConfig = createState()
    stateWithoutConfig.ctx.configService = undefined
    const helpersWithoutConfig = createRegistryHelpers(stateWithoutConfig)

    await expect(helpersWithoutConfig.registerLocalComponent('/project/src/components/a/index.wxml'))
      .rejects
      .toThrow('扫描组件前必须初始化 configService/jsonService。')

    const stateWithoutJson = createState()
    stateWithoutJson.ctx.jsonService = undefined
    const helpersWithoutJson = createRegistryHelpers(stateWithoutJson)

    await expect(helpersWithoutJson.registerLocalComponent('/project/src/components/a/index.wxml'))
      .rejects
      .toThrow('扫描组件前必须初始化 configService/jsonService。')
  })

  it('handles unresolved entries and keeps resolver metadata shells', async () => {
    const state = createState()
    state.registry.set('Comp', createLocalEntry('/project/src/components/comp/index'))
    state.resolverComponentNames.add('Comp')

    findJsEntryMock.mockResolvedValue({ path: undefined })
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findTemplateEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue(undefined)
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/comp/index.wxml')

    expect(state.componentMetadataMap.get('Comp')).toEqual({
      types: new Map(),
      docs: new Map(),
    })
    expect(state.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)
  })

  it('removes stale metadata when replaced component is no longer resolver-backed', async () => {
    const state = createState()
    state.registry.set('Comp', createLocalEntry('/project/src/components/comp/index'))
    state.componentMetadataMap.set('Comp', {
      types: new Map([['stale', 'string']]),
      docs: new Map([['stale', 'doc']]),
    })

    findJsEntryMock.mockResolvedValue({ path: undefined })
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findTemplateEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue(undefined)

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/comp/index.wxml')

    expect(state.componentMetadataMap.has('Comp')).toBe(false)
  })

  it('skips non-component json and duplicate component names', async () => {
    const nonComponentState = createState()
    nonComponentState.ctx.jsonService.read.mockResolvedValue({ component: false })
    const helpersA = createRegistryHelpers(nonComponentState)

    await helpersA.registerLocalComponent('/project/src/components/non-component/index.wxml')
    expect(nonComponentState.scheduleManifestWrite).toHaveBeenCalledWith(false)
    expect(nonComponentState.scheduleTypedComponentsWrite).toHaveBeenCalledWith(false)
    expect(nonComponentState.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(false)
    expect(nonComponentState.scheduleVueComponentsWrite).toHaveBeenCalledWith(false)

    const duplicateState = createState()
    duplicateState.registry.set('DupComp', createLocalEntry('/project/src/components/existing/index'))
    resolvedComponentNameMock.mockReturnValue({
      componentName: 'DupComp',
      base: 'dup',
    })
    const helpersB = createRegistryHelpers(duplicateState)

    await helpersB.registerLocalComponent('/project/src/components/dup/index.wxml')
    expect(duplicateState.logWarnOnce).toHaveBeenCalledWith(
      expect.stringContaining('发现 `DupComp` 组件重名!'),
    )
    expect(duplicateState.scheduleManifestWrite).toHaveBeenCalledWith(false)
  })

  it('returns early when resolved component name is empty', async () => {
    const state = createState()
    resolvedComponentNameMock.mockReturnValue({
      componentName: '',
      base: 'index',
    })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/nameless/index.wxml')

    expect(state.scheduleManifestWrite).toHaveBeenCalledWith(false)
    expect(state.scheduleTypedComponentsWrite).toHaveBeenCalledWith(false)
    expect(state.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(false)
    expect(state.scheduleVueComponentsWrite).toHaveBeenCalledWith(false)
    expect(state.registry.size).toBe(0)
  })

  it('warns and skips builtin component name collisions', async () => {
    const state = createState()
    resolvedComponentNameMock.mockReturnValue({
      componentName: 'list-view',
      base: 'index',
    })
    isBuiltinComponentMock.mockReturnValue(true)

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/list-view/index.wxml')

    expect(state.logWarnOnce).toHaveBeenCalledWith(
      expect.stringContaining('与微信内置组件 `list-view` 重名'),
    )
    expect(state.logWarnOnce).toHaveBeenCalledWith(
      expect.stringContaining('https://developers.weixin.qq.com/miniprogram/dev/component/'),
    )
    expect(state.registry.size).toBe(0)
    expect(state.scheduleManifestWrite).toHaveBeenCalledWith(false)
  })

  it('registers component with metadata merge and extraction fallback', async () => {
    const state = createState()
    state.ctx.configService.weappViteConfig = {
      ast: {
        engine: 'oxc',
      },
    }
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: true })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: true })

    resolvedComponentNameMock.mockReturnValue({
      componentName: 'FancyButton',
      base: 'index',
    })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/fancy-button/index.wxml')

    const resolved = state.registry.get('FancyButton')
    expect(resolved).toMatchObject({
      kind: 'local',
      value: {
        name: 'FancyButton',
        from: '/components/fancy-button/index',
      },
    })
    expect(state.componentMetadataMap.get('FancyButton')).toEqual({
      types: new Map([
        ['fromJson', 'number'],
        ['fromScript', 'string'],
      ]),
      docs: new Map([['fromJson', 'doc']]),
    })
    expect(extractComponentPropsMock).toHaveBeenCalledWith('export default {}', {
      astEngine: 'oxc',
    })
    expect(readJsonMock).not.toHaveBeenCalled()
    expect(state.scheduleManifestWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleTypedComponentsWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(true)
    expect(state.scheduleVueComponentsWrite).toHaveBeenCalledWith(true)

    const fallbackState = createState()
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })
    fallbackState.ctx.jsonService.read.mockResolvedValue({ component: true, source: 'jsonService' })
    readJsonMock.mockRejectedValueOnce(new Error('json parse failed'))
    extractJsonPropMetadataMock.mockReturnValueOnce({
      props: new Map([['fallback', 'boolean']]),
      docs: new Map([['fallback', 'from-json-service']]),
    })
    extractComponentPropsMock.mockImplementationOnce(() => {
      throw new Error('props parse failed')
    })
    resolvedComponentNameMock.mockReturnValueOnce({
      componentName: 'FallbackComp',
      base: 'index',
    })

    const helpersFallback = createRegistryHelpers(fallbackState)
    await helpersFallback.registerLocalComponent('/project/src/components/fallback/index.wxml')

    expect(fallbackState.componentMetadataMap.get('FallbackComp')).toEqual({
      types: new Map([['fallback', 'boolean']]),
      docs: new Map([['fallback', 'from-json-service']]),
    })
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('解析组件 `src/components/fallback/index.js` 属性失败: props parse failed'))
  })

  it('falls back to vue entry when js/json/template are missing', async () => {
    const state = createState()
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findTemplateEntryMock.mockResolvedValue({ path: undefined })
    extractConfigFromVueMock.mockResolvedValue({ component: true })
    resolvedComponentNameMock.mockReturnValue({
      componentName: 'VueCard',
      base: 'index',
    })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/vue-card/index.vue')

    expect(state.registry.get('VueCard')).toEqual({
      kind: 'local',
      entry: {
        path: '/project/src/components/vue-card/index.vue',
        json: { component: true },
        jsonPath: '/project/src/components/vue-card/index.vue',
        type: 'component',
        templatePath: '/project/src/components/vue-card/index.vue',
      },
      value: {
        name: 'VueCard',
        from: '/components/vue-card/index',
      },
    })
    expect(findVueEntryMock).not.toHaveBeenCalled()
  })

  it('extracts props from vue component script and handles missing compiled script', async () => {
    const state = createState()
    state.ctx.configService.weappViteConfig = {
      ast: {
        engine: 'oxc',
      },
    }
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findTemplateEntryMock.mockResolvedValue({ path: undefined })
    extractConfigFromVueMock.mockResolvedValue({ component: true })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })
    resolvedComponentNameMock.mockReturnValue({
      componentName: 'VueRichProps',
      base: 'index',
    })
    readFileMock.mockResolvedValue('<script setup lang="ts">const x = 1</script>')
    compileVueFileMock.mockResolvedValue({
      script: 'export default { properties: { fromVue: String } }',
    })
    extractComponentPropsMock.mockReturnValueOnce(new Map([['fromVueScript', 'string']]))

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/vue-rich/index.vue')

    expect(compileVueFileMock).toHaveBeenCalledWith(
      '<script setup lang="ts">const x = 1</script>',
      '/project/src/components/vue-rich/index.vue',
      {
        astEngine: 'oxc',
        json: {
          kind: 'component',
        },
      },
    )
    expect(extractComponentPropsMock).toHaveBeenCalledWith('export default { properties: { fromVue: String } }', {
      astEngine: 'oxc',
    })
    expect(state.componentMetadataMap.get('VueRichProps')).toEqual({
      types: new Map([
        ['fromJson', 'number'],
        ['fromVueScript', 'string'],
      ]),
      docs: new Map([['fromJson', 'doc']]),
    })

    const noScriptState = createState()
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findTemplateEntryMock.mockResolvedValue({ path: undefined })
    extractConfigFromVueMock.mockResolvedValue({ component: true })
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: true })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })
    resolvedComponentNameMock.mockReturnValueOnce({
      componentName: 'VueNoScript',
      base: 'index',
    })
    compileVueFileMock.mockResolvedValueOnce({ script: '' })

    const helpersNoScript = createRegistryHelpers(noScriptState)
    await helpersNoScript.registerLocalComponent('/project/src/components/vue-no-script/index.vue')

    expect(noScriptState.componentMetadataMap.get('VueNoScript')).toEqual({
      types: new Map([['fromJson', 'number']]),
      docs: new Map([['fromJson', 'doc']]),
    })
  })

  it('removes metadata when typed/html collection is disabled', async () => {
    const state = createState()
    getTypedComponentsSettingsMock.mockReturnValue({ enabled: false })
    getHtmlCustomDataSettingsMock.mockReturnValue({ enabled: false })
    getVueComponentsSettingsMock.mockReturnValue({ enabled: false })
    resolvedComponentNameMock.mockReturnValue({
      componentName: 'PlainComp',
      base: 'index',
    })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/plain-comp/index.wxml')

    expect(state.componentMetadataMap.has('PlainComp')).toBe(false)
    expect(state.scheduleTypedComponentsWrite).toHaveBeenCalledWith(false)
    expect(state.scheduleHtmlCustomDataWrite).toHaveBeenCalledWith(false)
    expect(state.scheduleVueComponentsWrite).toHaveBeenCalledWith(false)
  })

  it('skips vue fallback lookup when local component trio is already complete', async () => {
    const state = createState()
    const helpers = createRegistryHelpers(state)

    await helpers.registerLocalComponent('/project/src/components/fancy-button/index.wxml')

    expect(findVueEntryMock).not.toHaveBeenCalled()
    expect(extractConfigFromVueMock).not.toHaveBeenCalled()
  })

  it('looks up vue fallback only when local component trio is incomplete', async () => {
    const state = createState()
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue('/project/src/components/fancy-button/index.vue')
    extractConfigFromVueMock.mockResolvedValue({ component: true })

    const helpers = createRegistryHelpers(state)
    await helpers.registerLocalComponent('/project/src/components/fancy-button/index.wxml')

    expect(findVueEntryMock).toHaveBeenCalledWith('/project/src/components/fancy-button/index')
    expect(extractConfigFromVueMock).toHaveBeenCalledWith('/project/src/components/fancy-button/index.vue')
  })
})
