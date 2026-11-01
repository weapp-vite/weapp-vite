import type { my } from '@weapp-core/types/alipay-api'
import type { WechatMiniProgramApi } from '@weapp-core/types/wechat-api'

/**
 * @description 微信小程序 API 原始适配器类型源
 */
export type WeapiWechatMiniProgramRawAdapterSource = WechatMiniProgramApi

/**
 * @description 默认小程序 API 原始适配器类型源（当前复用微信 typings）
 */
export type WeapiDefaultMiniProgramRawAdapterSource = WeapiWechatMiniProgramRawAdapterSource

/**
 * @description 支付宝小程序 API 原始适配器类型源
 */
export type WeapiAlipayMiniProgramRawAdapterSource = typeof globalThis extends { my: infer Adapter }
  ? Adapter
  : typeof my

/**
 * @description 抖音小程序 API 原始适配器类型源
 */
export type WeapiDouyinMiniProgramRawAdapterSource = typeof import('@douyin-microapp/typings/types/api.js', { with: { 'resolution-mode': 'require' } })

/**
 * @description `tt` 命名兼容入口，保持与抖音宿主语义主名一致
 */
export type WeapiTtMiniProgramRawAdapterSource = WeapiDouyinMiniProgramRawAdapterSource

/**
 * @description 小程序平台语义原始适配器类型源 registry
 */
export interface WeapiMiniProgramPlatformRawAdapterSourceRegistry {
  default: WeapiDefaultMiniProgramRawAdapterSource
  wechat: WeapiWechatMiniProgramRawAdapterSource
  alipay: WeapiAlipayMiniProgramRawAdapterSource
  douyin: WeapiDouyinMiniProgramRawAdapterSource
}

/**
 * @description 小程序运行时别名原始适配器类型源 registry
 */
export interface WeapiMiniProgramRuntimeRawAdapterSourceRegistry {
  wx: WeapiWechatMiniProgramRawAdapterSource
  my: WeapiAlipayMiniProgramRawAdapterSource
  tt: WeapiTtMiniProgramRawAdapterSource
}

/**
 * @description 小程序平台语义原始适配器类型源名称
 */
export type WeapiMiniProgramPlatformRawAdapterSourceName = keyof WeapiMiniProgramPlatformRawAdapterSourceRegistry

/**
 * @description 小程序运行时别名原始适配器类型源名称
 */
export type WeapiMiniProgramRuntimeRawAdapterSourceName = keyof WeapiMiniProgramRuntimeRawAdapterSourceRegistry

/**
 * @description 小程序原始适配器类型源名称（兼容层联合视图）
 */
export type WeapiMiniProgramRawAdapterSourceName
  = WeapiMiniProgramPlatformRawAdapterSourceName
    | WeapiMiniProgramRuntimeRawAdapterSourceName
