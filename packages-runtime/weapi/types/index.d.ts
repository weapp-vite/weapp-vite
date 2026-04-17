/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />

// eslint-disable-next-line antfu/no-import-dist
import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayMethodName,
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinAdapter,
  WeapiDouyinMethodName,
  WeapiDouyinRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiMiniProgramAdapter,
  WeapiMiniProgramAlipayAdapter,
  WeapiMiniProgramAlipayMethodName,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramCrossPlatformAdapter,
  WeapiMiniProgramCrossPlatformRawAdapter,
  WeapiMiniProgramDouyinAdapter,
  WeapiMiniProgramDouyinMethodName,
  WeapiMiniProgramDouyinRawAdapter,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramMethodName,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRawAdapterSourceName,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSocketTask,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiMiniProgramWechatMethodName,
  WeapiMiniProgramWxAdapter,
  WeapiMiniProgramWxMethodName,
  WeapiMiniProgramWxRawAdapter,
  WeapiPlatformTypeSourceName,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiRuntimeTypeSourceName,
  WeapiSupportLevel,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiTypeSourceName,
  WeapiWechatMethodName,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWxAdapter,
  WeapiWxMethodName,
  WeapiWxRawAdapter,
} from '../dist/index.d.mts'

export declare const WEAPI_PLATFORM_TYPE_SOURCES: typeof import('../dist/index.mjs').WEAPI_PLATFORM_TYPE_SOURCES
export declare const WEAPI_RUNTIME_TYPE_SOURCES: typeof import('../dist/index.mjs').WEAPI_RUNTIME_TYPE_SOURCES
export declare const WEAPI_TYPE_SOURCES: typeof import('../dist/index.mjs').WEAPI_TYPE_SOURCES

export type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayMethodName,
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinAdapter,
  WeapiDouyinMethodName,
  WeapiDouyinRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiMiniProgramAdapter,
  WeapiMiniProgramAlipayAdapter,
  WeapiMiniProgramAlipayMethodName,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramCrossPlatformAdapter,
  WeapiMiniProgramCrossPlatformRawAdapter,
  WeapiMiniProgramDouyinAdapter,
  WeapiMiniProgramDouyinMethodName,
  WeapiMiniProgramDouyinRawAdapter,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramMethodName,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRawAdapterSourceName,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSocketTask,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiMiniProgramWechatMethodName,
  WeapiMiniProgramWxAdapter,
  WeapiMiniProgramWxMethodName,
  WeapiMiniProgramWxRawAdapter,
  WeapiPlatformTypeSourceName,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiRuntimeTypeSourceName,
  WeapiSupportLevel,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiTypeSourceName,
  WeapiWechatMethodName,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWxAdapter,
  WeapiWxMethodName,
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
