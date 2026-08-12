import type { MpPlatform } from '@weapp-core/shared'

export type TargetPlatformId = 'weapp' | 'tt' | 'ks' | 'alipay' | 'dingtalk' | 'swan'
export type VerificationPlatformId = TargetPlatformId | 'jd' | 'xhs'
export type VerificationStatus = 'required' | 'optional' | 'planned' | 'unsupported'

export interface PlatformBuildExpectation {
  platform: MpPlatform
  templateExt: string
  styleExt: string
  scriptModuleExt?: string
  eventAttr: string
  scriptModuleTag?: string
  projectConfigFile: string
  runtimeGlobal: string
}

export interface PlatformVerificationCapability {
  id: VerificationPlatformId
  aliases: readonly string[]
  roadmap: 'target' | 'compatibility'
  build: VerificationStatus
  ideCli: VerificationStatus
  runtimeAutomator: VerificationStatus
  expectation?: PlatformBuildExpectation
  limitation?: string
}

/**
 * 六个平台路线与既有兼容平台的唯一 E2E 验收清单。
 * planned 平台不得伪造产物契约；实现平台适配时必须同步提升状态并补齐 expectation。
 */
export const PLATFORM_VERIFICATION_CAPABILITIES = [
  {
    id: 'weapp',
    aliases: ['wechat', 'weixin', 'wx'],
    roadmap: 'target',
    build: 'required',
    ideCli: 'required',
    runtimeAutomator: 'required',
    expectation: {
      platform: 'weapp',
      templateExt: 'wxml',
      styleExt: 'wxss',
      scriptModuleExt: 'wxs',
      eventAttr: 'bind:tap',
      scriptModuleTag: '<wxs',
      projectConfigFile: 'project.config.json',
      runtimeGlobal: 'wx',
    },
  },
  {
    id: 'tt',
    aliases: ['toutiao', 'bytedance', 'douyin'],
    roadmap: 'target',
    build: 'required',
    ideCli: 'unsupported',
    runtimeAutomator: 'unsupported',
    expectation: {
      platform: 'tt',
      templateExt: 'ttml',
      styleExt: 'ttss',
      scriptModuleExt: 'wxs',
      eventAttr: 'bind:tap',
      scriptModuleTag: '<wxs',
      projectConfigFile: 'project.config.json',
      runtimeGlobal: 'tt',
    },
    limitation: '当前只提供构建产物复验，尚无稳定的开发者工具自动化后端。',
  },
  {
    id: 'ks',
    aliases: ['kuaishou', 'kwai'],
    roadmap: 'target',
    build: 'planned',
    ideCli: 'planned',
    runtimeAutomator: 'planned',
    limitation: '尚未进入公开 MpPlatform，也未验证模板、样式和脚本模块契约。',
  },
  {
    id: 'alipay',
    aliases: ['ali', 'my'],
    roadmap: 'target',
    build: 'required',
    ideCli: 'optional',
    runtimeAutomator: 'unsupported',
    expectation: {
      platform: 'alipay',
      templateExt: 'axml',
      styleExt: 'acss',
      scriptModuleExt: 'sjs',
      eventAttr: 'onTap',
      scriptModuleTag: '<import-sjs',
      projectConfigFile: 'mini.project.json',
      runtimeGlobal: 'my',
    },
    limitation: 'IDE smoke 依赖本机安装并登录 minidev，不进入无凭据 CI gate。',
  },
  {
    id: 'dingtalk',
    aliases: ['dingding', 'dd'],
    roadmap: 'target',
    build: 'planned',
    ideCli: 'planned',
    runtimeAutomator: 'planned',
    limitation: '尚未进入公开 MpPlatform，也未验证与支付宝语法族的差异边界。',
  },
  {
    id: 'swan',
    aliases: ['baidu', 'bd'],
    roadmap: 'target',
    build: 'required',
    ideCli: 'optional',
    runtimeAutomator: 'optional',
    expectation: {
      platform: 'swan',
      templateExt: 'swan',
      styleExt: 'css',
      scriptModuleExt: 'sjs',
      eventAttr: 'bind:tap',
      scriptModuleTag: '<sjs',
      projectConfigFile: 'project.swan.json',
      runtimeGlobal: 'swan',
    },
    limitation: '真实 runtime smoke 依赖百度开发者工具开启自动化 WebSocket 端点。',
  },
  {
    id: 'jd',
    aliases: ['jingdong'],
    roadmap: 'compatibility',
    build: 'required',
    ideCli: 'unsupported',
    runtimeAutomator: 'unsupported',
    expectation: {
      platform: 'jd',
      templateExt: 'jxml',
      styleExt: 'jxss',
      scriptModuleExt: 'wxs',
      eventAttr: 'bind:tap',
      scriptModuleTag: '<wxs',
      projectConfigFile: 'project.config.json',
      runtimeGlobal: 'jd',
    },
  },
  {
    id: 'xhs',
    aliases: ['xiaohongshu', 'little-red-book', 'red'],
    roadmap: 'compatibility',
    build: 'required',
    ideCli: 'unsupported',
    runtimeAutomator: 'unsupported',
    expectation: {
      platform: 'xhs',
      templateExt: 'xhsml',
      styleExt: 'css',
      scriptModuleExt: 'wxs',
      eventAttr: 'bind:tap',
      scriptModuleTag: '<wxs',
      projectConfigFile: 'project.config.json',
      runtimeGlobal: 'xhs',
    },
  },
] as const satisfies readonly PlatformVerificationCapability[]

export const TARGET_PLATFORM_IDS = PLATFORM_VERIFICATION_CAPABILITIES
  .filter(item => item.roadmap === 'target')
  .map(item => item.id) as TargetPlatformId[]

export const BUILD_VERIFICATION_CAPABILITIES = PLATFORM_VERIFICATION_CAPABILITIES
  .filter((item): item is typeof item & { expectation: PlatformBuildExpectation } => item.build === 'required')
