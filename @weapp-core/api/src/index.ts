/// <reference types="miniprogram-api-typings" />
import { createWeapi } from './core/createWeapi'

export {
  WEAPI_PLATFORM_TYPE_SOURCES,
  WEAPI_RUNTIME_TYPE_SOURCES,
  WEAPI_TYPE_SOURCES,
} from './core/apiCatalog'
export type {
  WeapiAlipayMethodName,
  WeapiDouyinMethodName,
  WeapiMiniProgramAlipayMethodName,
  WeapiMiniProgramDouyinMethodName,
  WeapiMiniProgramMethodName,
  WeapiMiniProgramWechatMethodName,
  WeapiMiniProgramWxMethodName,
  WeapiPlatformTypeSourceName,
  WeapiRuntimeTypeSourceName,
  WeapiTypeSourceName,
  WeapiWechatMethodName,
  WeapiWxMethodName,
} from './core/apiCatalog'

export type {
  WeapiDouyinMiniProgramRawAdapterSource,
  WeapiMiniProgramPlatformRawAdapterSourceName,
  WeapiMiniProgramPlatformRawAdapterSourceRegistry,
  WeapiMiniProgramRuntimeRawAdapterSourceName,
  WeapiMiniProgramRuntimeRawAdapterSourceRegistry,
  WeapiMiniProgramWechatRawAdapter,
  WeapiWechatRawAdapter,
} from './core/miniProgramTypes'

export {
  MINI_PROGRAM_API_PLATFORM_DESCRIPTORS,
  normalizeMiniProgramPlatform,
  resolveMiniProgramPlatform,
} from './core/platformRegistry'
export type { MiniProgramApiPlatformDescriptor } from './core/platformRegistry'
export type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiAlipayAdapter,
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinAdapter,
  WeapiDouyinRawAdapter,
  WeapiError,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiMiniProgramAdapter,
  WeapiMiniProgramAlipayAdapter,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramCrossPlatformAdapter,
  WeapiMiniProgramCrossPlatformRawAdapter,
  WeapiMiniProgramDouyinAdapter,
  WeapiMiniProgramDouyinRawAdapter,
  WeapiMiniProgramGeneralCallbackResult,
  WeapiMiniProgramLogManager,
  WeapiMiniProgramRawAdapter,
  WeapiMiniProgramRawAdapterSourceName,
  WeapiMiniProgramRequestFailResult,
  WeapiMiniProgramRequestMethod,
  WeapiMiniProgramRequestOption,
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
  WeapiMiniProgramSelectorQuery,
  WeapiMiniProgramSocketTask,
  WeapiMiniProgramSystemInfo,
  WeapiMiniProgramUpdateManager,
  WeapiMiniProgramVideoContext,
  WeapiMiniProgramWxAdapter,
  WeapiMiniProgramWxRawAdapter,
  WeapiNetworkOptions,
  WeapiNetworkOverflowPolicy,
  WeapiPromise,
  WeapiPromisify,
  WeapiResolvedTarget,
  WeapiSupportLevel,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
} from './core/types'
export type {
  CreateWeapiOptions as CreateApiOptions,
  WeapiInstance as MiniProgramApiInstance,
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
 * | QQ 小程序 (`qq`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 快手小程序 (`ks`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 京东小程序 (`jd`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 小红书小程序 (`xhs`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 钉钉小程序 (`dd`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 快应用 (`qa`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | 快应用 WebView (`qapp`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * | uni-app 运行时 (`uni`) | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export const api = createWeapi()

/**
 * @description 默认跨平台 API 实例的兼容名称。
 */
export const wpi = api

/**
 * @description 创建跨平台 API 实例
 */
export { createWeapi as createApi, createWeapi }
