import type { MiniProgramPlatformAdapter } from './types'
import { getAlipayNpmDistDirName } from '../utils/alipayNpm'

const DEFAULT_PROJECT_CONFIG_ROOT_KEYS = ['miniprogramRoot', 'srcMiniprogramRoot'] as const

export const MINI_PROGRAM_PLATFORM_ADAPTERS: readonly MiniProgramPlatformAdapter[] = [
  {
    id: 'weapp',
    displayName: 'WeChat Mini Program',
    aliases: ['weapp', 'wechat', 'weixin', 'wx'],
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
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
  },
  {
    id: 'alipay',
    displayName: 'Alipay Mini Program',
    aliases: ['alipay', 'ali', 'my'],
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
    resolvePreservedNpmDirNames: options => [getAlipayNpmDistDirName(options?.alipayNpmMode)],
    json: {
      normalizeUsingComponents: true,
      fillComponentGenericsDefault: true,
      rewriteBundleNpmImports: true,
    },
    npm: {
      distDirName: options => getAlipayNpmDistDirName(options?.alipayNpmMode),
      normalizeMiniprogramPackage: true,
      copyEsModuleDirectory: true,
      hoistNestedDependencies: true,
      shouldRebuildCachedPackage: true,
    },
    wxml: {
      eventBindingStyle: 'alipay',
      directivePrefix: 'a',
      normalizeComponentTagName: true,
      normalizeVueTemplate: true,
      emitGenericPlaceholder: true,
    },
    typescript: {
      appTypesPackage: '@mini-types/alipay',
    },
  },
  {
    id: 'swan',
    displayName: 'Baidu Smart Program',
    aliases: ['swan', 'baidu', 'bd'],
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
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
  },
  {
    id: 'tt',
    displayName: 'ByteDance / Douyin Mini Program',
    aliases: ['tt', 'toutiao', 'bytedance', 'douyin'],
    outputExtensions: {
      js: 'js',
      json: 'json',
      wxml: 'ttml',
      wxss: 'ttss',
    },
    projectConfigFileName: 'project.config.json',
    projectConfigRootKeys: DEFAULT_PROJECT_CONFIG_ROOT_KEYS,
    ide: {},
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
  },
  {
    id: 'jd',
    displayName: 'JD Mini Program',
    aliases: ['jd', 'jingdong'],
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
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
  },
  {
    id: 'xhs',
    displayName: 'Xiaohongshu Mini Program',
    aliases: ['xhs', 'xiaohongshu', 'little-red-book', 'red'],
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
    resolvePreservedNpmDirNames: () => ['miniprogram_npm'],
    json: {},
    npm: {
      distDirName: () => 'miniprogram_npm',
    },
    wxml: {
      eventBindingStyle: 'default',
      directivePrefix: 'wx',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
  },
] as const
