import type {
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramDouyinRawAdapter,
  WeapiMiniProgramWechatRawAdapter,
} from './miniProgramTypes'
import type { WeapiAdapter } from './types'

type MergeAdapters<Primary extends WeapiAdapter, Secondary extends WeapiAdapter>
  = Primary & Omit<Secondary, keyof Primary>

/**
 * @description 支付宝小程序 API 原始适配器类型
 */
export type WeapiAlipayRawAdapter = WeapiMiniProgramAlipayRawAdapter

/**
 * @description 抖音小程序 API 原始适配器类型
 */
export type WeapiDouyinRawAdapter = WeapiMiniProgramDouyinRawAdapter

/**
 * @description weapi 对齐后的跨平台原始 API 类型
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 全局对象 | 类型来源 | 对齐状态 |
 * | --- | --- | --- | --- |
 * | 微信小程序 | `wx` | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 | `my` | `@mini-types/alipay` | ✅ 全量 |
 * | 百度智能小程序 | `swan` | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 抖音小程序 | `tt` | `@douyin-microapp/typings` | ✅ 全量 |
 * | 京东小程序 | `jd` | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 小红书小程序 | `xhs` | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export type WeapiMiniProgramCrossPlatformRawAdapter = MergeAdapters<
  MergeAdapters<WeapiMiniProgramWechatRawAdapter, WeapiMiniProgramAlipayRawAdapter>,
  WeapiMiniProgramDouyinRawAdapter
>

/**
 * @description weapi 对齐后的跨平台原始 API 类型
 */
export type WeapiCrossPlatformRawAdapter = WeapiMiniProgramCrossPlatformRawAdapter
