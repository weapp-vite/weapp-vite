import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALIPAY_GENERIC_COMPONENT_PLACEHOLDER } from '../../../../utils'
import {
  emitAlipayGenericPlaceholderAssets,
  emitAlipayGenericPlaceholderAssetsByBase,
  emitPlatformConfigSideEffects,
  emitPlatformTemplateAsset,
  normalizeVueConfigForPlatform,
  normalizeVueTemplateForPlatform,
  prepareNormalizedVueConfigForPlatform,
  preparePlatformConfigAsset,
  resolveAlipayGenericPlaceholderBase,
  resolveGenericPlaceholderBaseForPlatform,
  resolvePlatformConfigAssetState,
  resolveVueBundlePlatformAssetOptions,
  resolveVueBundlePlatformOptions,
  shouldEmitAlipayGenericPlaceholder,
  trackPlatformTemplateAnalysis,
  transformVueTemplateForPlatform,
} from './platform'

const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitSfcTemplateIfMissingMock = vi.hoisted(() => vi.fn())
const ensureScriptlessComponentAssetMock = vi.hoisted(() => vi.fn())
const resolveJsonMock = vi.hoisted(() => vi.fn((payload: any) => JSON.stringify(payload.json)))
const scanWxmlMock = vi.hoisted(() => vi.fn((template: string) => ({ template })))
const handleWxmlMock = vi.hoisted(() => vi.fn((token: any) => ({ code: `normalized:${token.template}` })))

vi.mock('../../../utils/scriptlessComponent', () => ({
  ensureScriptlessComponentAsset: ensureScriptlessComponentAssetMock,
}))

vi.mock('../../../../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../utils')>()
  return {
    ...actual,
    resolveJson: resolveJsonMock,
  }
})

vi.mock('../../../../wxml', () => ({
  scanWxml: scanWxmlMock,
}))

vi.mock('../../../../wxml/handle', () => ({
  handleWxml: handleWxmlMock,
}))

vi.mock('../emitAssets', () => ({
  emitSfcJsonAsset: emitSfcJsonAssetMock,
  emitSfcTemplateIfMissing: emitSfcTemplateIfMissingMock,
}))

describe('bundle platform helpers', () => {
  beforeEach(() => {
    emitSfcJsonAssetMock.mockReset()
    emitSfcTemplateIfMissingMock.mockReset()
    ensureScriptlessComponentAssetMock.mockReset()
    resolveJsonMock.mockReset()
    resolveJsonMock.mockImplementation((payload: any) => JSON.stringify(payload.json))
    scanWxmlMock.mockReset()
    scanWxmlMock.mockImplementation((template: string) => ({ template }))
    handleWxmlMock.mockReset()
    handleWxmlMock.mockImplementation((token: any) => ({ code: `normalized:${token.template}` }))
  })

  it('resolves platform bundle options from platform-specific capabilities', () => {
    expect(resolveVueBundlePlatformOptions({
      platform: 'alipay',
      scriptModuleExtension: 'sjs',
    })).toEqual({
      normalizeUsingComponents: true,
      normalizeTemplate: true,
      emitGenericPlaceholder: true,
      scriptModuleTag: 'import-sjs',
    })

    expect(resolveVueBundlePlatformOptions({
      platform: 'weapp',
      scriptModuleExtension: 'wxs',
    })).toEqual({
      normalizeUsingComponents: false,
      normalizeTemplate: false,
      emitGenericPlaceholder: false,
      scriptModuleTag: undefined,
    })
  })

  it('resolves platform asset options from config service state', () => {
    expect(resolveVueBundlePlatformAssetOptions({
      configService: {
        platform: 'alipay',
        packageJson: {
          dependencies: {
            dayjs: '^1.11.0',
          },
        },
        weappViteConfig: {
          npm: {
            alipayNpmMode: 'node_modules',
          },
        },
      } as any,
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
    })).toEqual({
      platform: 'alipay',
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
      dependencies: {
        dayjs: '^1.11.0',
      },
      alipayNpmMode: 'node_modules',
    })
  })

  it('normalizes vue config only for platforms that require usingComponents normalization', () => {
    const config = JSON.stringify({
      usingComponents: {
        card: 'pkg/card',
      },
    })

    expect(normalizeVueConfigForPlatform(config, {
      platform: 'weapp',
    })).toBe(config)

    expect(normalizeVueConfigForPlatform(config, {
      platform: 'alipay',
      dependencies: {
        dayjs: '^1.11.0',
      },
      alipayNpmMode: 'node_modules',
    })).toBe(config)

    expect(resolveJsonMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to original vue config when normalization input is invalid', () => {
    expect(normalizeVueConfigForPlatform('{', {
      platform: 'alipay',
      dependencies: {
        dayjs: '^1.11.0',
      },
      alipayNpmMode: 'node_modules',
    })).toBe('{')
  })

  it('transforms vue template through shared platform wxml pipeline', () => {
    expect(transformVueTemplateForPlatform('<view />', {
      platform: 'alipay',
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
      scriptModuleTag: 'import-sjs',
    })).toBe('normalized:<view />')

    expect(scanWxmlMock).toHaveBeenCalledWith('<view />', {
      platform: 'alipay',
    })
    expect(handleWxmlMock).toHaveBeenCalledWith(
      { template: '<view />' },
      {
        templateExtension: 'axml',
        scriptModuleExtension: 'sjs',
        scriptModuleTag: 'import-sjs',
      },
    )
  })

  it('normalizes vue template only for platforms that require template transforms', () => {
    expect(normalizeVueTemplateForPlatform('<view />', {
      platform: 'weapp',
      templateExtension: 'wxml',
      scriptModuleExtension: 'wxs',
    })).toBe('<view />')

    expect(normalizeVueTemplateForPlatform('<view />', {
      platform: 'alipay',
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
    })).toBe('normalized:<view />')
  })

  it('falls back to original vue template when platform template transform throws', () => {
    handleWxmlMock.mockImplementation(() => {
      throw new Error('transform failed')
    })

    expect(normalizeVueTemplateForPlatform('<view />', {
      platform: 'alipay',
      templateExtension: 'axml',
      scriptModuleExtension: 'sjs',
    })).toBe('<view />')
  })

  it('resolves alipay generic placeholder base from page-relative path', () => {
    expect(resolveAlipayGenericPlaceholderBase('pages/demo/index')).toBe(`pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`)
    expect(resolveAlipayGenericPlaceholderBase('generic-host')).toBe(ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2))
  })

  it('detects whether alipay generic placeholder assets are needed from config', () => {
    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify({
      componentGenerics: {
        list: true,
      },
    }))).toBe(true)

    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify({
      componentGenerics: {
        list: {
          default: ALIPAY_GENERIC_COMPONENT_PLACEHOLDER,
        },
      },
    }))).toBe(true)

    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify({
      componentGenerics: {
        list: {
          default: './custom',
        },
      },
    }))).toBe(false)

    expect(shouldEmitAlipayGenericPlaceholder(undefined)).toBe(false)
    expect(shouldEmitAlipayGenericPlaceholder('{')).toBe(false)
    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify([]))).toBe(false)
    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify({
      componentGenerics: [],
    }))).toBe(false)
    expect(shouldEmitAlipayGenericPlaceholder(JSON.stringify({
      componentGenerics: {
        list: 'bad-value',
      },
    }))).toBe(false)
  })

  it('resolves generic placeholder base only for platforms that need it', () => {
    const configSource = JSON.stringify({
      componentGenerics: {
        list: true,
      },
    })

    expect(resolveGenericPlaceholderBaseForPlatform(
      'pages/demo/index',
      configSource,
      'alipay',
    )).toBe(`pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`)

    expect(resolveGenericPlaceholderBaseForPlatform(
      'pages/demo/index',
      configSource,
      'weapp',
    )).toBeUndefined()

    expect(resolveGenericPlaceholderBaseForPlatform(
      'pages/demo/index',
      undefined,
      'alipay',
    )).toBeUndefined()

    expect(resolveGenericPlaceholderBaseForPlatform(
      'pages/demo/index',
      JSON.stringify({
        componentGenerics: {
          list: {
            default: './custom',
          },
        },
      }),
      'alipay',
    )).toBeUndefined()
  })

  it('emits generic placeholder template, json, and scriptless assets by base', () => {
    emitAlipayGenericPlaceholderAssetsByBase(
      { emitFile: vi.fn() },
      {},
      'pages/demo/generic',
      {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
    )

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/demo/generic',
      '<view />',
      'axml',
    )
    expect(emitSfcJsonAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/demo/generic',
      { config: JSON.stringify({ component: true }) },
      {
        extension: 'json',
        kind: 'component',
      },
    )
    expect(ensureScriptlessComponentAssetMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/demo/generic',
      'mjs',
    )
  })

  it('emits placeholder assets only when the current platform requires them', () => {
    const pluginCtx = { emitFile: vi.fn() }
    const bundle = {}
    const configSource = JSON.stringify({
      componentGenerics: {
        list: true,
      },
    })

    emitAlipayGenericPlaceholderAssets(
      pluginCtx,
      bundle,
      'pages/demo/index',
      configSource,
      {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
      'weapp',
    )

    expect(emitSfcTemplateIfMissingMock).not.toHaveBeenCalled()

    emitAlipayGenericPlaceholderAssets(
      pluginCtx,
      bundle,
      'pages/demo/index',
      configSource,
      {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
      'alipay',
    )

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      pluginCtx,
      bundle,
      `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
      '<view />',
      'axml',
    )
  })

  it('prepares normalized vue config through the shared platform helper', () => {
    const config = JSON.stringify({
      usingComponents: {
        card: 'pkg/card',
      },
    })

    expect(prepareNormalizedVueConfigForPlatform({
      config,
      platform: 'alipay',
      dependencies: {
        dayjs: '^1.11.0',
      },
      alipayNpmMode: 'node_modules',
    })).toBe(config)

    expect(resolveJsonMock).toHaveBeenCalledTimes(1)
  })

  it('resolves platform config asset state with normalized config and placeholder base', () => {
    const config = JSON.stringify({
      componentGenerics: {
        list: true,
      },
    })

    expect(resolvePlatformConfigAssetState({
      relativeBase: 'pages/demo/index',
      config,
      platform: 'alipay',
    })).toEqual({
      normalizedConfig: config,
      genericPlaceholderBase: `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
    })
  })

  it('emits platform config side effects from resolved placeholder base directly', () => {
    emitPlatformConfigSideEffects({}, {
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/demo/index',
      config: '{"componentGenerics":{"list":true}}',
      outputExtensions: {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
      platform: 'alipay',
      genericPlaceholderBase: `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
    })

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
      '<view />',
      'axml',
    )
  })

  it('falls back to config-driven placeholder side effects when resolved base is absent', () => {
    emitPlatformConfigSideEffects({}, {
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/demo/index',
      config: '{"componentGenerics":{"list":true}}',
      outputExtensions: {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
      platform: 'alipay',
    })

    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
      '<view />',
      'axml',
    )
  })

  it('prepares platform config asset through normalized config and resolved side effects', () => {
    const config = JSON.stringify({
      componentGenerics: {
        list: true,
      },
    })

    const result = preparePlatformConfigAsset({}, {
      pluginCtx: { emitFile: vi.fn() },
      relativeBase: 'pages/demo/index',
      config,
      outputExtensions: {
        wxml: 'axml',
        json: 'json',
        js: 'mjs',
      } as any,
      platform: 'alipay',
    })

    expect(result).toBe(config)
    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      `pages/demo/${ALIPAY_GENERIC_COMPONENT_PLACEHOLDER.slice(2)}`,
      '<view />',
      'axml',
    )
  })

  it('tracks platform template analysis into wxml service caches', () => {
    const analyze = vi.fn(() => ({
      components: ['demo-card'],
      deps: [],
    }))
    const tokenMapSet = vi.fn()
    const setWxmlComponentsMap = vi.fn()
    const collectDepsFromToken = vi.fn(() => [])
    const setDeps = vi.fn()

    trackPlatformTemplateAnalysis({
      wxmlService: {
        analyze,
        tokenMap: {
          set: tokenMapSet,
        },
        collectDepsFromToken,
        setDeps,
        setWxmlComponentsMap,
      },
    } as any, '/project/src/pages/demo/index.vue', '<view />')

    expect(analyze).toHaveBeenCalledWith('<view />')
    expect(tokenMapSet).toHaveBeenCalledWith('/project/src/pages/demo/index.vue', {
      components: ['demo-card'],
      deps: [],
    })
    expect(collectDepsFromToken).toHaveBeenCalledWith('/project/src/pages/demo/index.vue', [])
    expect(setDeps).toHaveBeenCalledWith('/project/src/pages/demo/index.vue', [])
    expect(setWxmlComponentsMap).toHaveBeenCalledWith('/project/src/pages/demo/index.vue', ['demo-card'])
  })

  it('skips platform template analysis when wxml service is unavailable', () => {
    expect(() => {
      trackPlatformTemplateAnalysis({} as any, '/project/src/pages/demo/index.vue', '<view />')
    }).not.toThrow()
  })

  it('emits platform template assets even when template analysis fails', () => {
    const analyze = vi.fn(() => {
      throw new Error('scan failed')
    })

    const result = emitPlatformTemplateAsset({}, {
      ctx: {
        wxmlService: {
          analyze,
          tokenMap: {
            set: vi.fn(),
          },
          collectDepsFromToken: vi.fn(() => []),
          setDeps: vi.fn(),
          setWxmlComponentsMap: vi.fn(),
        },
      } as any,
      pluginCtx: { emitFile: vi.fn() },
      filename: '/project/src/pages/demo/index.vue',
      relativeBase: 'pages/demo/index',
      template: '<view />',
      platform: 'weapp',
      templateExtension: 'wxml',
      scriptModuleExtension: 'wxs',
    })

    expect(result).toBe('<view />')
    expect(emitSfcTemplateIfMissingMock).toHaveBeenCalledWith(
      expect.anything(),
      {},
      'pages/demo/index',
      '<view />',
      'wxml',
    )
  })
})
