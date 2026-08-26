export type RuntimePlatform = 'web' | 'weapp' | 'alipay' | 'tt' | 'swan' | 'jd' | 'xhs'

const PLATFORM_LABELS: Record<RuntimePlatform, string> = {
  web: 'Web 端',
  weapp: '微信小程序',
  tt: '抖音小程序',
  swan: '百度智能小程序',
  jd: '京东小程序',
  alipay: '支付宝小程序',
  xhs: '小红书小程序',
}

const PLATFORM_DOCS: Partial<Record<RuntimePlatform, string>> = {
  web: 'https://vite.weapp.dev/guide/web.html',
  weapp: 'https://developers.weixin.qq.com/miniprogram/dev/framework/',
  tt: 'https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/introduction/overview',
  swan: 'https://smartprogram.baidu.com/docs/develop/tutorial/getting-started/',
  jd: 'https://mp.jd.com/doc',
  alipay: 'https://opendocs.alipay.com/mini/01n8le',
  xhs: 'https://open.xiaohongshu.com/document',
}

export const platform = import.meta.env.PLATFORM as RuntimePlatform
export const isWeb = import.meta.env.IS_WEB
export const isMiniProgram = import.meta.env.IS_MINIPROGRAM

const platformName = PLATFORM_LABELS[platform] ?? (isWeb ? 'Web 端' : '小程序端')

export const platformClass = [
  isWeb ? 'runtime-web' : 'runtime-miniprogram',
  `platform-${platform}`,
].join(' ')

export const platformWrapperAccent = `platform-accent-${platform}`

export const platformBadge = `目标平台 · ${platformName}`

export const platformDisplayName = platformName

export const platformBanner = isWeb
  ? '🌐 当前运行在浏览器端，支持热更新与 DevTools 调试。'
  : `📱 当前运行在 ${platformName}，可结合开发者工具与真机体验。`

export const platformFeature = isWeb
  ? 'Web 运行时可以直接在浏览器控制台调用 `wx.*` API。'
  : `${platformName} 运行时能够访问原生能力（API / 组件 / IDE 调试）。`

export const platformCta = isWeb
  ? '了解 Web 运行时能力'
  : `了解 ${platformName} 运行时能力`

export const platformDocLink = PLATFORM_DOCS[platform]
export const platformDocsLabel = isWeb ? '浏览器运行指南' : `${platformName} 官方文档`

const PLATFORM_EXTRAS = [
  '复用同一套 weapp-vite 构建与热更新流程',
  isWeb ? '直接集成浏览器生态组件库与调试工具' : `${platformName} 原生能力保持可用`,
  platform === 'weapp' ? '支持微信云开发、插件、多端 CI 等生态能力' : undefined,
  platform === 'alipay' ? '内置 ACSS / AXML 转换与支付宝 IDE 调试适配' : undefined,
  platform === 'tt' ? '支持抖音小程序快应用加速与小游戏扩展' : undefined,
  platform === 'swan' ? '自动适配百度智能小程序 API 差异' : undefined,
  platform === 'jd' ? '生成京东小程序定制的目录结构与配置' : undefined,
  platform === 'xhs' ? '输出小红书小程序特定的包结构与样式扩展' : undefined,
].filter((item): item is string => Boolean(item))

export const platformExamples = PLATFORM_EXTRAS
