import { describe, expect, it } from 'vitest'
import {
  createMiniProgramPlatformRegistry,
  DEFAULT_MP_PLATFORM,
  getDefaultIdeProjectRoot,
  getMiniProgramPlatformAdapter,
  getPreservedNpmDirNames,
  MINI_PLATFORM_ALIASES,
  normalizeMiniPlatform,
  resolveMiniPlatform,
  shouldPassPlatformArgToIdeOpen,
} from './platform'

describe('platform adapter registry', () => {
  it('normalizes and resolves platform aliases', () => {
    expect(DEFAULT_MP_PLATFORM).toBe('weapp')
    expect(normalizeMiniPlatform('  WeChat  ')).toBe('wechat')
    expect(normalizeMiniPlatform('   ')).toBeUndefined()
    expect(normalizeMiniPlatform('')).toBeUndefined()
    expect(resolveMiniPlatform(' wx ')).toBe('weapp')
    expect(resolveMiniPlatform('   ')).toBeUndefined()
    expect(resolveMiniPlatform('MY')).toBe('alipay')
    expect(resolveMiniPlatform('baidu')).toBe('swan')
    expect(resolveMiniPlatform('douyin')).toBe('tt')
    expect(resolveMiniPlatform('jingdong')).toBe('jd')
    expect(resolveMiniPlatform('red')).toBe('xhs')
    expect(resolveMiniPlatform('unknown')).toBeUndefined()
  })

  it('exposes adapter metadata for every supported platform', () => {
    expect(MINI_PLATFORM_ALIASES.wx).toBe('weapp')
    expect(getMiniProgramPlatformAdapter('weapp')).toMatchObject({
      displayName: 'WeChat Mini Program',
      projectConfigFileName: 'project.config.json',
      projectConfigRootKeys: ['miniprogramRoot', 'srcMiniprogramRoot'],
      outputExtensions: {
        wxml: 'wxml',
        wxss: 'wxss',
        wxs: 'wxs',
      },
    })
    expect(getMiniProgramPlatformAdapter('alipay')).toMatchObject({
      projectConfigFileName: 'mini.project.json',
      projectConfigRootKeys: ['miniprogramRoot', 'srcMiniprogramRoot'],
      scriptModuleTagByExtension: {
        sjs: 'import-sjs',
      },
      usesProjectRootNpmDir: true,
      ide: {
        requiresOpenPlatformArg: true,
        defaultProjectRoot: 'dist/alipay/dist',
      },
    })
    expect(getMiniProgramPlatformAdapter('swan')).toMatchObject({
      projectConfigFileName: 'project.swan.json',
      projectConfigRootKeys: ['smartProgramRoot', 'miniprogramRoot', 'srcMiniprogramRoot'],
      outputExtensions: {
        wxml: 'swan',
        wxss: 'css',
        wxs: 'sjs',
      },
    })
    expect(getMiniProgramPlatformAdapter('tt').outputExtensions.wxml).toBe('ttml')
    expect(getMiniProgramPlatformAdapter('jd').outputExtensions.wxml).toBe('jxml')
    expect(getMiniProgramPlatformAdapter('xhs').outputExtensions.wxml).toBe('xhsml')
  })

  it('resolves helper behaviors from adapters', () => {
    expect(shouldPassPlatformArgToIdeOpen()).toBe(false)
    expect(shouldPassPlatformArgToIdeOpen('weapp')).toBe(false)
    expect(shouldPassPlatformArgToIdeOpen('alipay')).toBe(true)
    expect(getDefaultIdeProjectRoot()).toBeUndefined()
    expect(getDefaultIdeProjectRoot('weapp')).toBeUndefined()
    expect(getDefaultIdeProjectRoot('alipay')).toBe('dist/alipay/dist')
    expect(getPreservedNpmDirNames('weapp')).toEqual(['miniprogram_npm'])
    expect(getPreservedNpmDirNames('alipay', { alipayNpmMode: 'miniprogram_npm' })).toEqual(['miniprogram_npm'])
    expect(getPreservedNpmDirNames('alipay', { alipayNpmMode: 'node_modules' })).toEqual(['node_modules'])
  })

  it('throws for unsupported platform ids', () => {
    expect(() => getMiniProgramPlatformAdapter('ks' as any)).toThrow('不支持的小程序平台 "ks"')
  })

  it('builds registry entries with normalized aliases and implicit id aliases', () => {
    const registry = createMiniProgramPlatformRegistry([
      {
        id: 'weapp',
        displayName: 'WeChat Mini Program',
        aliases: [' wx ', ''],
        outputExtensions: {
          js: 'js',
          json: 'json',
          wxml: 'wxml',
          wxss: 'wxss',
        },
        projectConfigFileName: 'project.config.json',
        projectConfigRootKeys: ['miniprogramRoot'],
        resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
      },
    ])

    expect(registry.adapterById.get('weapp')?.displayName).toBe('WeChat Mini Program')
    expect(registry.aliasToId.get('wx')).toBe('weapp')
    expect(registry.aliasToId.get('weapp')).toBe('weapp')
    expect(registry.aliasToId.has('')).toBe(false)
  })
})
