/// <reference types="miniprogram-api-typings" />
import type {
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinMiniProgramRawAdapterSource,
  WeapiWechatMiniProgramRawAdapterSource,
} from './miniProgramTypeSources'

export type {
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinMiniProgramRawAdapterSource,
  WeapiMiniProgramPlatformRawAdapterSourceName,
  WeapiMiniProgramPlatformRawAdapterSourceRegistry,
  WeapiMiniProgramRawAdapterSourceName,
  WeapiMiniProgramRuntimeRawAdapterSourceName,
  WeapiMiniProgramRuntimeRawAdapterSourceRegistry,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiWechatMiniProgramRawAdapterSource,
} from './miniProgramTypeSources'

/**
 * @description 微信小程序 API 原始适配器类型
 */
export type WeapiWxRawAdapter = WeapiWechatMiniProgramRawAdapterSource

/**
 * @description 微信小程序 API 原始适配器类型（宿主中立别名）
 */
export type WeapiMiniProgramWxRawAdapter = WeapiWxRawAdapter

/**
 * @description 支付宝小程序 API 原始适配器类型（宿主中立主名）
 */
export type WeapiMiniProgramAlipayRawAdapter = WeapiAlipayMiniProgramRawAdapterSource

/**
 * @description 抖音小程序 API 原始适配器类型（宿主中立主名）
 */
export type WeapiMiniProgramDouyinRawAdapter = WeapiDouyinMiniProgramRawAdapterSource

/**
 * @description 小程序主适配器类型（当前以微信 typings 作为基准）
 */
export type WeapiMiniProgramRawAdapter = WeapiDefaultMiniProgramRawAdapterSource

type WeapiMiniProgramRawRequestOption = Parameters<WeapiMiniProgramRawAdapter['request']>[0]
type WeapiMiniProgramRawConnectSocketOption = Parameters<WeapiMiniProgramRawAdapter['connectSocket']>[0]
type WeapiMiniProgramCreateBleConnectionOption = Parameters<WeapiMiniProgramRawAdapter['createBLEConnection']>[0]
type WeapiMiniProgramClipboardOption = Parameters<WeapiMiniProgramRawAdapter['getClipboardData']>[0]

/**
 * @description 小程序请求参数类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestOption = WeapiMiniProgramRawRequestOption

/**
 * @description 小程序请求方法类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestMethod = NonNullable<WeapiMiniProgramRequestOption['method']>

/**
 * @description 小程序请求任务类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestTask = ReturnType<WeapiMiniProgramRawAdapter['request']>

/**
 * @description 小程序请求成功结果类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestSuccessResult = Parameters<NonNullable<WeapiMiniProgramRequestOption['success']>>[0]

/**
 * @description 小程序连接 WebSocket 参数类型（宿主中立别名）
 */
export type WeapiMiniProgramConnectSocketOption = WeapiMiniProgramRawConnectSocketOption

/**
 * @description 小程序 WebSocket 任务类型（宿主中立别名）
 */
export type WeapiMiniProgramSocketTask = ReturnType<WeapiMiniProgramRawAdapter['connectSocket']>

/**
 * @description 小程序系统信息类型（宿主中立别名）
 */
export type WeapiMiniProgramSystemInfo = ReturnType<WeapiMiniProgramRawAdapter['getSystemInfoSync']>

/**
 * @description 小程序更新管理器类型（宿主中立别名）
 */
export type WeapiMiniProgramUpdateManager = ReturnType<WeapiMiniProgramRawAdapter['getUpdateManager']>

/**
 * @description 小程序日志管理器类型（宿主中立别名）
 */
export type WeapiMiniProgramLogManager = ReturnType<WeapiMiniProgramRawAdapter['getLogManager']>

/**
 * @description 小程序视频上下文类型（宿主中立别名）
 */
export type WeapiMiniProgramVideoContext = ReturnType<WeapiMiniProgramRawAdapter['createVideoContext']>

/**
 * @description 小程序选择器查询类型（宿主中立别名）
 */
export type WeapiMiniProgramSelectorQuery = ReturnType<WeapiMiniProgramRawAdapter['createSelectorQuery']>

/**
 * @description 小程序蓝牙错误类型（宿主中立别名）
 */
export type WeapiMiniProgramBluetoothError = Parameters<NonNullable<WeapiMiniProgramCreateBleConnectionOption['fail']>>[0]

/**
 * @description 小程序剪贴板读取结果类型（宿主中立别名）
 */
export type WeapiMiniProgramClipboardDataResult = Parameters<NonNullable<NonNullable<WeapiMiniProgramClipboardOption>['success']>>[0]
