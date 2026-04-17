/// <reference types="miniprogram-api-typings" />
import { createWeapi } from './core/createWeapi'

export type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDouyinAdapter,
  WeapiDouyinRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiMiniProgramAdapter,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSystemInfo,
  WeapiNetworkOptions,
  WeapiNetworkOverflowPolicy,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiSupportLevel,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
} from './core/types'

/**
 * @description 默认跨平台 API 实例（推荐使用）
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 类型来源 | 支持度 |
 * | --- | --- | --- |
 * | 微信小程序 (`wx`) | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 (`my`) | `@mini-types/alipay` | ✅ 全量 |
 * | 百度智能小程序 (`swan`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 抖音小程序 (`tt`) | `@douyin-microapp/typings` | ✅ 全量 |
 * | 京东小程序 (`jd`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 小红书小程序 (`xhs`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export const wpi = createWeapi()

/**
 * @description 创建跨平台 API 实例
 */
export { createWeapi }
