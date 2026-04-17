/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />

// eslint-disable-next-line antfu/no-import-dist
import type {
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
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiSupportLevel,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
} from '../dist/index.d.mts'

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
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiSupportLevel,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
}

export function createWeapi<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>(
  options?: CreateWeapiOptions<TAdapter>,
): WeapiInstance<TAdapter>

export type WeapiDefaultInstance = WeapiInstance<WeapiCrossPlatformRawAdapter>

/**
 * 默认跨平台 API 实例。
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
export const wpi: WeapiDefaultInstance
