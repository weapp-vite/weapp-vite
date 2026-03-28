import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALIPAY_GENERIC_COMPONENT_PLACEHOLDER } from '../../../../utils'
import {
  emitAlipayGenericPlaceholderAssets,
  emitAlipayGenericPlaceholderAssetsByBase,
  resolveAlipayGenericPlaceholderBase,
  resolveGenericPlaceholderBaseForPlatform,
  resolveVueBundlePlatformOptions,
  shouldEmitAlipayGenericPlaceholder,
} from './platform'

const emitSfcJsonAssetMock = vi.hoisted(() => vi.fn())
const emitSfcTemplateIfMissingMock = vi.hoisted(() => vi.fn())
const ensureScriptlessComponentAssetMock = vi.hoisted(() => vi.fn())

vi.mock('../../../utils/scriptlessComponent', () => ({
  ensureScriptlessComponentAsset: ensureScriptlessComponentAssetMock,
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
})
