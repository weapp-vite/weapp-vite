/// <reference types="miniprogram-api-typings" />

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
