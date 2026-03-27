import { describe, expect, it } from 'vitest'
import {
  createMiniProgramPlatformRegistry,
  DEFAULT_MP_PLATFORM,
  getDefaultIdeProjectRoot,
  getMiniProgramPlatformAdapter,
  getPlatformAppTypesPackage,
  getPlatformNpmDistDirName,
  getPlatformNpmImportPrefix,
  getPlatformScriptModuleTag,
  getPreservedNpmDirNames,
  getProjectPlatformOptions,
  getScriptModulePlatformOptions,
  getWxmlDirectivePrefix,
  getWxmlEventBindingStyle,
  getWxmlPlatformTransformOptions,
  MINI_PLATFORM_ALIASES,
  normalizeMiniPlatform,
  normalizePlatformNpmImportPath,
  resolveMiniPlatform,
  shouldCopyEsModuleDirectory,
  shouldEmitGenericPlaceholderAsset,
  shouldFillComponentGenericsDefault,
  shouldHoistNestedMiniprogramDependencies,
  shouldNormalizeMiniprogramPackage,
  shouldNormalizePlatformNpmImportPath,
  shouldNormalizeUsingComponents,
  shouldNormalizeVueTemplateForPlatform,
  shouldNormalizeWxmlComponentTagName,
  shouldPassPlatformArgToIdeOpen,
  shouldRebuildCachedMiniprogramPackage,
  shouldRewriteBundleNpmImports,
  shouldUseProjectRootNpmDir,
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
    expect(getProjectPlatformOptions('weapp')).toEqual({
      projectConfigFileName: 'project.config.json',
      projectConfigRootKeys: ['miniprogramRoot', 'srcMiniprogramRoot'],
      usesProjectRootNpmDir: false,
    })
    expect(getProjectPlatformOptions('alipay')).toEqual({
      projectConfigFileName: 'mini.project.json',
      projectConfigRootKeys: ['miniprogramRoot', 'srcMiniprogramRoot'],
      usesProjectRootNpmDir: true,
    })
    expect(shouldNormalizeUsingComponents()).toBe(false)
    expect(shouldNormalizeUsingComponents('weapp')).toBe(false)
    expect(shouldNormalizeUsingComponents('alipay')).toBe(true)
    expect(shouldFillComponentGenericsDefault()).toBe(false)
    expect(shouldFillComponentGenericsDefault('weapp')).toBe(false)
    expect(shouldFillComponentGenericsDefault('alipay')).toBe(true)
    expect(shouldRewriteBundleNpmImports()).toBe(false)
    expect(shouldRewriteBundleNpmImports('weapp')).toBe(false)
    expect(shouldRewriteBundleNpmImports('alipay')).toBe(true)
    expect(shouldNormalizePlatformNpmImportPath()).toBe(false)
    expect(getWxmlEventBindingStyle()).toBe('default')
    expect(getWxmlEventBindingStyle('weapp')).toBe('default')
    expect(getWxmlEventBindingStyle('alipay')).toBe('alipay')
    expect(getWxmlDirectivePrefix()).toBe('wx')
    expect(getWxmlDirectivePrefix('alipay')).toBe('a')
    expect(getWxmlPlatformTransformOptions()).toEqual({
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
      normalizeComponentTagName: false,
      normalizeVueTemplate: false,
      emitGenericPlaceholder: false,
    })
    expect(getWxmlPlatformTransformOptions('alipay')).toEqual({
      eventBindingStyle: 'alipay',
      directivePrefix: 'a',
      normalizeComponentTagName: true,
      normalizeVueTemplate: true,
      emitGenericPlaceholder: true,
    })
    expect(shouldNormalizeWxmlComponentTagName('weapp')).toBe(false)
    expect(shouldNormalizeWxmlComponentTagName('alipay')).toBe(true)
    expect(shouldNormalizeVueTemplateForPlatform('weapp')).toBe(false)
    expect(shouldNormalizeVueTemplateForPlatform('alipay')).toBe(true)
    expect(shouldEmitGenericPlaceholderAsset('weapp')).toBe(false)
    expect(shouldEmitGenericPlaceholderAsset('alipay')).toBe(true)
    expect(getPlatformAppTypesPackage()).toBe('miniprogram-api-typings')
    expect(getPlatformAppTypesPackage('weapp')).toBe('miniprogram-api-typings')
    expect(getPlatformAppTypesPackage('alipay')).toBe('@mini-types/alipay')
    expect(getPlatformNpmDistDirName('weapp')).toBe('miniprogram_npm')
    expect(getPlatformNpmDistDirName('alipay', { alipayNpmMode: 'node_modules' })).toBe('node_modules')
    expect(shouldNormalizePlatformNpmImportPath('weapp')).toBe(false)
    expect(shouldNormalizePlatformNpmImportPath('alipay')).toBe(true)
    expect(getPlatformNpmImportPrefix('weapp')).toBe('/miniprogram_npm/')
    expect(getPlatformNpmImportPrefix('alipay', { alipayNpmMode: 'node_modules' })).toBe('/node_modules/')
    expect(normalizePlatformNpmImportPath('weapp', 'npm:dayjs')).toBe('npm:dayjs')
    expect(normalizePlatformNpmImportPath('alipay', 'npm:dayjs')).toBe('/node_modules/dayjs')
    expect(normalizePlatformNpmImportPath('alipay', '/miniprogram_npm/dayjs', { alipayNpmMode: 'node_modules' })).toBe('/node_modules/dayjs')
    expect(getScriptModulePlatformOptions()).toEqual({
      tagByExtension: {},
    })
    expect(getScriptModulePlatformOptions('alipay')).toEqual({
      tagByExtension: {
        sjs: 'import-sjs',
      },
    })
    expect(getPlatformScriptModuleTag(undefined, undefined)).toBeUndefined()
    expect(getPlatformScriptModuleTag(undefined, 'sjs')).toBeUndefined()
    expect(getPlatformScriptModuleTag('alipay', 'sjs')).toBe('import-sjs')
    expect(getPlatformScriptModuleTag('alipay', 'wxs')).toBeUndefined()
    expect(shouldUseProjectRootNpmDir('weapp')).toBe(false)
    expect(shouldUseProjectRootNpmDir('alipay')).toBe(true)
    expect(getPreservedNpmDirNames('weapp')).toEqual(['miniprogram_npm'])
    expect(getPreservedNpmDirNames('alipay', { alipayNpmMode: 'miniprogram_npm' })).toEqual(['miniprogram_npm'])
    expect(getPreservedNpmDirNames('alipay', { alipayNpmMode: 'node_modules' })).toEqual(['node_modules'])
    expect(shouldRebuildCachedMiniprogramPackage('weapp')).toBe(false)
    expect(shouldRebuildCachedMiniprogramPackage('alipay')).toBe(true)
    expect(shouldNormalizeMiniprogramPackage('weapp')).toBe(false)
    expect(shouldNormalizeMiniprogramPackage('alipay')).toBe(true)
    expect(shouldCopyEsModuleDirectory('weapp')).toBe(false)
    expect(shouldCopyEsModuleDirectory('alipay')).toBe(true)
    expect(shouldNormalizeWxmlComponentTagName()).toBe(false)
    expect(shouldHoistNestedMiniprogramDependencies('weapp')).toBe(false)
    expect(shouldHoistNestedMiniprogramDependencies('alipay')).toBe(true)
    expect(shouldNormalizeVueTemplateForPlatform()).toBe(false)
    expect(shouldEmitGenericPlaceholderAsset()).toBe(false)
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
