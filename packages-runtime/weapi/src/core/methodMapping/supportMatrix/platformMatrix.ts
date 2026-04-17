import type { WeapiPlatformSupportMatrixItem } from '../types'
import { MINI_PROGRAM_PLATFORM_DESCRIPTORS } from '@weapp-core/shared'

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  weapp: '微信小程序',
  alipay: '支付宝小程序',
  tt: '抖音小程序',
  swan: '百度智能小程序',
  jd: '京东小程序',
  xhs: '小红书小程序',
}

const PLATFORM_TYPE_SOURCE: Readonly<Record<string, string>> = {
  weapp: '`miniprogram-api-typings`',
  alipay: '`@mini-types/alipay`',
  tt: '`@douyin-microapp/typings`',
}

export const WEAPI_PLATFORM_SUPPORT_MATRIX: readonly WeapiPlatformSupportMatrixItem[] = MINI_PROGRAM_PLATFORM_DESCRIPTORS.map((descriptor) => {
  const globalObject = descriptor.runtime.globalObjectKey
  const isFullyTypedPlatform = descriptor.id in PLATFORM_TYPE_SOURCE
  return {
    platform: PLATFORM_LABELS[descriptor.id] ?? descriptor.displayName,
    globalObject: `\`${globalObject}\``,
    typeSource: PLATFORM_TYPE_SOURCE[descriptor.id] ?? '运行时透传',
    support: isFullyTypedPlatform ? '✅ 全量' : '⚠️ 按宿主能力支持',
  }
})
