import { describe, expect, it } from 'vitest'
import {
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramPlatformDescriptor,
  getMiniProgramRuntimeGlobalKeys,
  getMiniProgramTemplatePreset,
  getSupportedMiniProgramPlatforms,
  MINI_PROGRAM_PLATFORM_ALIASES,
  normalizeMiniProgramPlatform,
  resolveMiniProgramPageKeys,
  resolveMiniProgramPlatform,
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
    expect(MINI_PROGRAM_PLATFORM_ALIASES.wx).toBe('weapp')
    expect(getSupportedMiniProgramPlatforms()).toEqual(['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs'])
  })

  it('exposes template preset and runtime metadata from the shared descriptor', () => {
    expect(getMiniProgramTemplatePreset('weapp')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('jd')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('xhs')).toBe('wechat')
    expect(getMiniProgramTemplatePreset('swan')).toBe('swan')
    expect(getMiniProgramPlatformDescriptor('alipay').runtime.globalObjectKey).toBe('my')
    expect(getMiniProgramPlatformByRuntimeGlobalKey('wx')).toBe('weapp')
    expect(getMiniProgramPlatformByRuntimeGlobalKey('xhs')).toBe('xhs')
    expect(getMiniProgramRuntimeGlobalKeys()).toEqual(['wx', 'my', 'swan', 'tt', 'jd', 'xhs'])
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
