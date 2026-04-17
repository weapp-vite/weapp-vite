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
 * @description 小程序原始适配器类型源名称
 */
export type WeapiMiniProgramRawAdapterSourceName = 'default' | 'wechat' | 'alipay' | 'tt'

/**
 * @description 支付宝小程序 API 原始适配器类型源
 */
export type WeapiAlipayMiniProgramRawAdapterSource = typeof my

/**
 * @description 抖音小程序 API 原始适配器类型源
 */
export type WeapiTtMiniProgramRawAdapterSource = typeof tt
