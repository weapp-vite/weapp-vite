/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />

/**
 * @description 微信小程序 API 原始适配器类型源
 */
export type WeapiWechatMiniProgramRawAdapterSource = WechatMiniprogram.Wx

/**
 * @description 默认小程序 API 原始适配器类型源（当前复用微信 typings）
 */
export type WeapiDefaultMiniProgramRawAdapterSource = WeapiWechatMiniProgramRawAdapterSource

/**
 * @description 支付宝小程序 API 原始适配器类型源
 */
export type WeapiAlipayMiniProgramRawAdapterSource = typeof my

/**
 * @description 抖音小程序 API 原始适配器类型源
 */
export type WeapiTtMiniProgramRawAdapterSource = typeof tt

/**
 * @description 小程序平台语义原始适配器类型源 registry
 */
export interface WeapiMiniProgramPlatformRawAdapterSourceRegistry {
  default: WeapiDefaultMiniProgramRawAdapterSource
  wechat: WeapiWechatMiniProgramRawAdapterSource
  alipay: WeapiAlipayMiniProgramRawAdapterSource
  douyin: WeapiTtMiniProgramRawAdapterSource
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
