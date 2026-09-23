import type { MiniProgramPlatformDescriptor, MiniProgramRuntimeCapabilities } from '../types'

export type MiniProgramRuntimeDescriptor = Pick<MiniProgramPlatformDescriptor, 'id' | 'aliases' | 'runtime'>

export const DEFAULT_RUNTIME_HOST_CONFIG_KEY = '__wxConfig'

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
  appErrorListener: true,
  appPageNotFoundListener: true,
  appUnhandledRejectionListener: true,
  appThemeChangeListener: true,
  appMemoryWarningListener: true,
})
const DEFAULT_PAGE_IDENTITY_RULES = [
  {
    prefix: 'route',
    source: 'route',
  },
] as const

export const WEAPP_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'weapp',
  aliases: ['weapp', 'wechat', 'weixin', 'wx'],
  runtime: {
    globalObjectKey: 'wx',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    globalResolvePriority: 1,
    routeGlobalResolvePriority: 0,
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
}

export const ALIPAY_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'alipay',
  aliases: ['alipay', 'ali', 'my'],
  runtime: {
    globalObjectKey: 'my',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    globalResolvePriority: 0,
    routeGlobalResolvePriority: 2,
    capabilities: {
      ...DEFAULT_RUNTIME_CAPABILITIES,
      pageShareMenu: false,
      appThemeChangeListener: false,
    },
    pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
  },
}

export const SWAN_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'swan',
  aliases: ['swan', 'baidu', 'bd'],
  runtime: {
    globalObjectKey: 'swan',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
  },
}

export const TT_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'tt',
  aliases: ['tt', 'toutiao', 'bytedance', 'douyin'],
  runtime: {
    globalObjectKey: 'tt',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    globalResolvePriority: 2,
    routeGlobalResolvePriority: 1,
    capabilities: {
      ...DEFAULT_RUNTIME_CAPABILITIES,
      appThemeChangeListener: false,
    },
    pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
  },
}

export const JD_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'jd',
  aliases: ['jd', 'jingdong'],
  runtime: {
    globalObjectKey: 'jd',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
  },
}

export const XHS_RUNTIME_DESCRIPTOR: MiniProgramRuntimeDescriptor = {
  id: 'xhs',
  aliases: ['xhs', 'xiaohongshu', 'little-red-book', 'red'],
  runtime: {
    globalObjectKey: 'xhs',
    hostConfigKey: DEFAULT_RUNTIME_HOST_CONFIG_KEY,
    capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    pageIdentityRules: DEFAULT_PAGE_IDENTITY_RULES,
  },
}

export const MINI_PROGRAM_RUNTIME_DESCRIPTORS: readonly MiniProgramRuntimeDescriptor[] = [
  WEAPP_RUNTIME_DESCRIPTOR,
  ALIPAY_RUNTIME_DESCRIPTOR,
  SWAN_RUNTIME_DESCRIPTOR,
  TT_RUNTIME_DESCRIPTOR,
  JD_RUNTIME_DESCRIPTOR,
  XHS_RUNTIME_DESCRIPTOR,
]
