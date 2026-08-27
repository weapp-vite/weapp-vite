export interface MiniProgramApiPlatformDescriptor {
  id: string
  displayName: string
  globalObjectKey: string
  aliases: readonly string[]
  hostConfigKey?: string
  typeSource?: string
}

/**
 * @description 内置小程序宿主注册表；未知宿主仍可通过显式 adapter 接入。
 */
export const MINI_PROGRAM_API_PLATFORM_DESCRIPTORS: readonly MiniProgramApiPlatformDescriptor[] = [
  {
    id: 'weapp',
    displayName: '微信小程序',
    globalObjectKey: 'wx',
    aliases: ['weapp', 'wechat', 'weixin', 'wx'],
    hostConfigKey: '__wxConfig',
    typeSource: '`miniprogram-api-typings`',
  },
  {
    id: 'alipay',
    displayName: '支付宝 / 淘宝小程序',
    globalObjectKey: 'my',
    aliases: ['alipay', 'ali', 'my', 'taobao'],
    hostConfigKey: '__wxConfig',
    typeSource: '`@mini-types/alipay`',
  },
  {
    id: 'swan',
    displayName: '百度智能小程序',
    globalObjectKey: 'swan',
    aliases: ['swan', 'baidu', 'bd'],
    hostConfigKey: '__wxConfig',
  },
  {
    id: 'tt',
    displayName: '抖音小程序',
    globalObjectKey: 'tt',
    aliases: ['tt', 'toutiao', 'bytedance', 'douyin'],
    hostConfigKey: '__wxConfig',
    typeSource: '`@douyin-microapp/typings`',
  },
  {
    id: 'qq',
    displayName: 'QQ 小程序',
    globalObjectKey: 'qq',
    aliases: ['qq'],
  },
  {
    id: 'ks',
    displayName: '快手小程序',
    globalObjectKey: 'ks',
    aliases: ['ks', 'kuaishou'],
  },
  {
    id: 'jd',
    displayName: '京东小程序',
    globalObjectKey: 'jd',
    aliases: ['jd', 'jingdong'],
    hostConfigKey: '__wxConfig',
  },
  {
    id: 'xhs',
    displayName: '小红书小程序',
    globalObjectKey: 'xhs',
    aliases: ['xhs', 'xiaohongshu', 'red'],
    hostConfigKey: '__wxConfig',
  },
  {
    id: 'dd',
    displayName: '钉钉小程序',
    globalObjectKey: 'dd',
    aliases: ['dd', 'dingtalk', 'dingding'],
  },
  {
    id: 'quickapp',
    displayName: '快应用',
    globalObjectKey: 'qa',
    aliases: ['qa', 'quickapp'],
  },
  {
    id: 'quickapp-webview',
    displayName: '快应用 WebView',
    globalObjectKey: 'qapp',
    aliases: ['qapp', 'quickapp-webview'],
  },
  {
    id: 'uni',
    displayName: 'uni-app 运行时',
    globalObjectKey: 'uni',
    aliases: ['uni', 'uniapp', 'uni-app'],
  },
]

const descriptorById = new Map<string, MiniProgramApiPlatformDescriptor>()
const descriptorByAlias = new Map<string, MiniProgramApiPlatformDescriptor>()
const descriptorByGlobalObjectKey = new Map<string, MiniProgramApiPlatformDescriptor>()

for (const descriptor of MINI_PROGRAM_API_PLATFORM_DESCRIPTORS) {
  descriptorById.set(descriptor.id, descriptor)
  descriptorByGlobalObjectKey.set(descriptor.globalObjectKey, descriptor)
  descriptorByAlias.set(descriptor.id, descriptor)
  for (const alias of descriptor.aliases) {
    descriptorByAlias.set(alias, descriptor)
  }
}

/**
 * @description 标准化外部传入的平台名称。
 */
export function normalizeMiniProgramPlatform(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized || undefined
}

/**
 * @description 根据平台标识、别名或宿主全局键解析平台描述。
 */
export function resolveMiniProgramPlatform(value?: string | null): MiniProgramApiPlatformDescriptor | undefined {
  const normalized = normalizeMiniProgramPlatform(value)
  if (!normalized) {
    return undefined
  }
  return descriptorByAlias.get(normalized) ?? descriptorByGlobalObjectKey.get(normalized)
}

/**
 * @description 获取平台对应的小程序宿主全局键。
 */
export function getMiniProgramRuntimeGlobalKey(platform: string): string {
  return descriptorById.get(platform)?.globalObjectKey ?? platform
}

/**
 * @description 返回内置平台的宿主全局键。
 */
export function getMiniProgramRuntimeGlobalKeys(): readonly string[] {
  return MINI_PROGRAM_API_PLATFORM_DESCRIPTORS.map(descriptor => descriptor.globalObjectKey)
}

/**
 * @description 根据宿主全局键解析平台标识。
 */
export function getMiniProgramPlatformByRuntimeGlobalKey(globalObjectKey?: string | null): string | undefined {
  return globalObjectKey ? descriptorByGlobalObjectKey.get(globalObjectKey)?.id : undefined
}

/**
 * @description 获取小程序宿主配置对象的全局键。
 */
export function getMiniProgramRuntimeHostConfigKey(platform?: string): string {
  return (platform ? descriptorById.get(platform)?.hostConfigKey : undefined) ?? '__wxConfig'
}
