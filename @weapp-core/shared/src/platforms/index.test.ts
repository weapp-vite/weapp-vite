import { describe, expect, it } from 'vitest'
import {
  getDefaultMiniProgramPlatform,
  getDefaultMiniProgramRuntimeGlobalKey,
  getMiniProgramAppTypesPackage,
  getMiniProgramDefaultBuildTarget,
  getMiniProgramDirectivePrefix,
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramPlatformDescriptor,
  getMiniProgramRouteRuntimeGlobalKeys,
  getMiniProgramRuntimeCapabilities,
  getMiniProgramRuntimeGlobalKeys,
  getMiniProgramRuntimeGlobalKeysByResolvePriority,
  getMiniProgramRuntimeHostConfigKey,
  getMiniProgramTemplatePreset,
  getSupportedMiniProgramDirectivePrefixes,
  getSupportedMiniProgramPlatforms,
  MINI_PROGRAM_PLATFORM_ALIASES,
  normalizeMiniProgramPlatform,
  resolveMiniProgramPageKeys,
  resolveMiniProgramPlatform,
  supportsMiniProgramAutoTouchAppStyle,
  supportsMiniProgramRuntimeCapability,
} from './index'

describe('mini program platform registry', () => {
  it('normalizes and resolves platform aliases', () => {
    expect(normalizeMiniProgramPlatform('  WeChat  ')).toBe('wechat')
    expect(normalizeMiniProgramPlatform('')).toBeUndefined()
    expect(resolveMiniProgramPlatform('wx')).toBe('weapp')
    expect(resolveMiniProgramPlatform('MY')).toBe('alipay')
    expect(resolveMiniProgramPlatform('douyin')).toBe('tt')
    expect(resolveMiniProgramPlatform('baidu')).toBe('swan')
    expect(resolveMiniProgramPlatform('jingdong')).toBe('jd')
    expect(resolveMiniProgramPlatform('red')).toBe('xhs')
    expect(getDefaultMiniProgramPlatform()).toBe('weapp')
    expect(MINI_PROGRAM_PLATFORM_ALIASES.wx).toBe('weapp')
    expect(getSupportedMiniProgramPlatforms()).toEqual(['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs'])
  })

  it('exposes template preset and runtime metadata from the shared descriptor', () => {
    expect(getMiniProgramTemplatePreset('weapp')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('jd')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('xhs')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('swan')).toBe('swan')
    expect(getMiniProgramDirectivePrefix('weapp')).toBe('wx')
    expect(getMiniProgramDirectivePrefix('alipay')).toBe('a')
    expect(getMiniProgramDirectivePrefix('tt')).toBe('tt')
    expect(getMiniProgramDirectivePrefix('swan')).toBe('s')
    expect(getSupportedMiniProgramDirectivePrefixes()).toEqual(['wx', 'a', 's', 'tt'])
    expect(supportsMiniProgramAutoTouchAppStyle('weapp')).toBe(true)
    expect(supportsMiniProgramAutoTouchAppStyle('alipay')).toBe(false)
    expect(getMiniProgramDefaultBuildTarget('weapp')).toBe('es2020')
    expect(getMiniProgramDefaultBuildTarget('alipay')).toBe('es2015')
    expect(getMiniProgramDefaultBuildTarget('tt')).toBeUndefined()
    expect(getMiniProgramAppTypesPackage()).toBe('miniprogram-api-typings')
    expect(getMiniProgramAppTypesPackage('alipay')).toBe('@mini-types/alipay')
    expect(getMiniProgramAppTypesPackage('tt')).toBe('@douyin-microapp/typings')
    expect(getMiniProgramPlatformDescriptor('alipay').runtime.globalObjectKey).toBe('my')
    expect(getDefaultMiniProgramRuntimeGlobalKey()).toBe('wx')
    expect(getMiniProgramPlatformByRuntimeGlobalKey('wx')).toBe('weapp')
    expect(getMiniProgramPlatformByRuntimeGlobalKey('xhs')).toBe('xhs')
    expect(getMiniProgramRuntimeGlobalKeys()).toEqual(['wx', 'my', 'swan', 'tt', 'jd', 'xhs'])
    expect(getMiniProgramRuntimeGlobalKeysByResolvePriority()).toEqual(['my', 'wx', 'tt', 'swan', 'jd', 'xhs'])
    expect(getMiniProgramRouteRuntimeGlobalKeys()).toEqual(['wx', 'tt', 'my', 'swan', 'jd', 'xhs'])
    expect(getMiniProgramRuntimeHostConfigKey('weapp')).toBe('__wxConfig')
    expect(supportsMiniProgramRuntimeCapability('weapp', 'pageShareMenu')).toBe(true)
    expect(supportsMiniProgramRuntimeCapability('alipay', 'pageShareMenu')).toBe(false)
    expect(supportsMiniProgramRuntimeCapability('weapp', 'globalRouterApi')).toBe(true)
    expect(supportsMiniProgramRuntimeCapability('alipay', 'appThemeChangeListener')).toBe(false)
    expect(supportsMiniProgramRuntimeCapability('tt', 'appThemeChangeListener')).toBe(false)
    expect(supportsMiniProgramRuntimeCapability('weapp', 'appMemoryWarningListener')).toBe(true)
    expect(getMiniProgramRuntimeCapabilities('alipay').shareTimelineRequiresShareAppMessage).toBe(true)
  })

  it('resolves page identity keys from route and host-specific fields', () => {
    expect(resolveMiniProgramPageKeys({
      route: '/pages/index/index',
      __wxWebviewId__: 7,
      __wxExparserNodeId__: 'node-1',
    }, 'weapp')).toEqual([
      'webview:7',
      'exparser:node-1',
      'route:pages/index/index',
    ])

    expect(resolveMiniProgramPageKeys({
      route: '/pages/demo/index',
      __wxWebviewId__: 9,
    }, 'xhs')).toEqual([
      'route:pages/demo/index',
    ])

    expect(resolveMiniProgramPageKeys({
      route: '/pages/demo/index',
      __wxWebviewId__: 9,
    })).toEqual([
      'webview:9',
      'route:pages/demo/index',
    ])
  })
})
