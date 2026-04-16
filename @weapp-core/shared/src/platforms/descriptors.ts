import type { MiniProgramPlatformDescriptor, MiniProgramRuntimeCapabilities } from './types'

const DEFAULT_PROJECT_CONFIG_ROOT_KEYS = ['miniprogramRoot', 'srcMiniprogramRoot'] as const
export const DEFAULT_RUNTIME_CAPABILITIES: MiniProgramRuntimeCapabilities = Object.freeze({
  globalPageStack: true,
  globalCreateSelectorQuery: true,
  selectorQueryScopeByIn: true,
  globalCreateIntersectionObserver: true,
  intersectionObserverScopeByParameter: true,
  pageShareMenu: true,
  shareTimelineRequiresShareAppMessage: true,
  pageScrollApi: true,
  pullDownRefreshApi: true,
  globalRouterApi: true,
})
const DEFAULT_PAGE_IDENTITY_RULES = [
  {
    prefix: 'route',
    source: 'route',
  },
] as const

/**
 * @description 全仓库统一的小程序平台描述表。
 */
export const MINI_PROGRAM_PLATFORM_DESCRIPTORS: readonly MiniProgramPlatformDescriptor[] = [
  {
    id: 'weapp',
    displayName: 'WeChat Mini Program',
    family: 'wechat',
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
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: {
      globalObjectKey: 'wx',
      hostConfigKey: '__wxConfig',
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
      pageIdentityRules: [
        {
          prefix: 'webview',
          source: 'field',
          field: '__wxWebviewId__',
        },
        {
          prefix: 'exparser',
          source: 'field',
          field: '__wxExparserNodeId__',
        },
        ...DEFAULT_PAGE_IDENTITY_RULES,
      ],
    },
  },
  {
    id: 'alipay',
    displayName: 'Alipay Mini Program',
    family: 'alipay',
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
      directivePrefix: 'a',
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
    runtime: {
      globalObjectKey: 'my',
      hostConfigKey: '__wxConfig',
      capabilities: {
        ...DEFAULT_RUNTIME_CAPABILITIES,
        pageShareMenu: false,
      },
      pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
    },
  },
  {
    id: 'swan',
    displayName: 'Baidu Smart Program',
    family: 'swan',
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
    compiler: {
      templatePreset: 'swan',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: {
      globalObjectKey: 'swan',
      hostConfigKey: '__wxConfig',
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
      pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
    },
  },
  {
    id: 'tt',
    displayName: 'ByteDance / Douyin Mini Program',
    family: 'tt',
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
    compiler: {
      templatePreset: 'tt',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: {
      globalObjectKey: 'tt',
      hostConfigKey: '__wxConfig',
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
      pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
    },
  },
  {
    id: 'jd',
    displayName: 'JD Mini Program',
    family: 'wechat',
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
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: {
      globalObjectKey: 'jd',
      hostConfigKey: '__wxConfig',
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
      pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
    },
  },
  {
    id: 'xhs',
    displayName: 'Xiaohongshu Mini Program',
    family: 'wechat',
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
    compiler: {
      templatePreset: 'wechat',
    },
    typescript: {
      appTypesPackage: 'miniprogram-api-typings',
    },
    runtime: {
      globalObjectKey: 'xhs',
      hostConfigKey: '__wxConfig',
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
      pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
    },
  },
] as const
