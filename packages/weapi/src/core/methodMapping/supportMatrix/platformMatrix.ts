import type { WeapiPlatformSupportMatrixItem } from '../types'

export const WEAPI_PLATFORM_SUPPORT_MATRIX: readonly WeapiPlatformSupportMatrixItem[] = [
  {
    platform: '微信小程序',
    globalObject: '`wx`',
    typeSource: '`miniprogram-api-typings`',
    support: '✅ 全量',
  },
  {
    platform: '支付宝小程序',
    globalObject: '`my`',
    typeSource: '`@mini-types/alipay`',
    support: '✅ 全量',
  },
  {
    platform: '抖音小程序',
    globalObject: '`tt`',
    typeSource: '`@douyin-microapp/typings`',
    support: '✅ 全量',
  },
  {
    platform: '其他平台（swan/jd/xhs 等）',
    globalObject: '运行时宿主对象',
    typeSource: '运行时透传',
    support: '⚠️ 按宿主能力支持',
  },
]
