import type { MiniProgramPlatformDescriptor } from './types'
import { ALIPAY_RUNTIME_DESCRIPTOR, JD_RUNTIME_DESCRIPTOR, SWAN_RUNTIME_DESCRIPTOR, TT_RUNTIME_DESCRIPTOR, WEAPP_RUNTIME_DESCRIPTOR, XHS_RUNTIME_DESCRIPTOR } from './runtime/descriptors'
import { MINI_PROGRAM_DIRECTIVE_PREFIXES } from './runtime/template'

const DEFAULT_PROJECT_CONFIG_ROOT_KEYS = ['miniprogramRoot', 'srcMiniprogramRoot'] as const
/**
 * @description 全仓库统一的小程序平台描述表。
 */
export const MINI_PROGRAM_PLATFORM_DESCRIPTORS: readonly MiniProgramPlatformDescriptor[] = [
  {
    id: 'weapp',
    displayName: 'WeChat Mini Program',
    family: 'wechat',
    aliases: WEAPP_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'wxml',
      wxss: 'wxss',
      wxs: 'wxs',
    },
    projectConfigFileName: 'project.config.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    ide: {},
    build: {
      autoTouchAppStyle: true,
      defaultBuildTarget: 'es2020',
    },
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.weapp,
    },
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: WEAPP_RUNTIME_DESCRIPTOR.runtime,
  },
  {
    id: 'alipay',
    displayName: 'Alipay Mini Program',
    family: 'alipay',
    aliases: ALIPAY_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'axml',
      wxss: 'acss',
      wxs: 'sjs',
    },
    projectConfigFileName: 'mini.project.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    scriptModuleTagByExtension: {
      sjs: 'import-sjs',
    },
    usesProjectRootNpmDir: true,
    ide: {
      requiresOpenPlatformArg: true,
      defaultProjectRoot: 'dist/alipay/dist',
    },
    build: {
      autoTouchAppStyle: false,
      defaultBuildTarget: 'es2015',
    },
    resolvePreservedNpmDirNames: options => [options?.alipayNpmMode === 'miniprogram_npm' ? 'miniprogram_npm' : 'node_modules'],
    json: {
      normalizeUsingComponents: true,
      fillComponentGenericsDefault: true,
      rewriteBundleNpmImports: true,
    },
    npm: {
      distDirName: options => options?.alipayNpmMode === 'miniprogram_npm' ? 'miniprogram_npm' : 'node_modules',
      normalizeImportPath: true,
      normalizeMiniprogramPackage: true,
      copyEsModuleDirectory: true,
      hoistNestedDependencies: true,
      shouldRebuildCachedPackage: true,
    },
    wxml: {
      eventBindingStyle: 'alipay',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.alipay,
      normalizeComponentTagName: true,
      normalizeVueTemplate: true,
      emitGenericPlaceholder: true,
    },
    compiler: {
      templatePreset: 'alipay',
    },
    typescript: {
      appTypesPackage: '@mini-types/alipay',
    },
    runtime: ALIPAY_RUNTIME_DESCRIPTOR.runtime,
  },
  {
    id: 'swan',
    displayName: 'Baidu Smart Program',
    family: 'swan',
    aliases: SWAN_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'swan',
      wxss: 'css',
      wxs: 'sjs',
    },
    projectConfigFileName: 'project.swan.json',
    projectConfigRootKeys: ['smartProgramRoot', ...DEFAULT_PROJECT_CONFIG_ROOT_KEYS],
    ide: {},
    build: {
      autoTouchAppStyle: false,
    },
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.swan,
    },
    compiler: {
      templatePreset: 'swan',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: SWAN_RUNTIME_DESCRIPTOR.runtime,
  },
  {
    id: 'tt',
    displayName: 'ByteDance / Douyin Mini Program',
    family: 'tt',
    aliases: TT_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'ttml',
      wxss: 'ttss',
    },
    projectConfigFileName: 'project.config.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    ide: {},
    build: {
      autoTouchAppStyle: false,
    },
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {
      normalizeUsingComponents: true,
      rewriteBundleNpmImports: true,
    },
    npm: {
      distDirName: () => 'miniprogram_npm',
      normalizeImportPath: true,
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.tt,
      normalizeComponentTagName: true,
    },
    compiler: {
      templatePreset: 'tt',
    },
    typescript: {
      appTypesPackage: '@douyin-microapp/typings',
    },
    runtime: TT_RUNTIME_DESCRIPTOR.runtime,
  },
  {
    id: 'jd',
    displayName: 'JD Mini Program',
    family: 'wechat',
    aliases: JD_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'jxml',
      wxss: 'jxss',
      wxs: 'wxs',
    },
    projectConfigFileName: 'project.config.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    ide: {},
    build: {
      autoTouchAppStyle: false,
    },
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.jd,
    },
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: JD_RUNTIME_DESCRIPTOR.runtime,
  },
  {
    id: 'xhs',
    displayName: 'Xiaohongshu Mini Program',
    family: 'wechat',
    aliases: XHS_RUNTIME_DESCRIPTOR.aliases,
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'xhsml',
      wxss: 'css',
      wxs: 'wxs',
    },
    projectConfigFileName: 'project.config.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    ide: {},
    build: {
      autoTouchAppStyle: false,
    },
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: MINI_PROGRAM_DIRECTIVE_PREFIXES.xhs,
    },
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: XHS_RUNTIME_DESCRIPTOR.runtime,
  },
] as const
