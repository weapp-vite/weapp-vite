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
export type WeapiWechatRawAdapter = WeapiWechatMiniProgramRawAdapterSource

/**
 * @description 微信小程序 API 原始适配器类型（宿主中立主名）
 */
export type WeapiMiniProgramWechatRawAdapter = WeapiWechatRawAdapter

/**
 * @description `wx` 命名兼容入口，保持与微信宿主语义主名一致
 */
export type WeapiWxRawAdapter = WeapiWechatRawAdapter

/**
 * @description `wx` 命名兼容入口，保持与微信宿主语义主名一致
 */
export type WeapiMiniProgramWxRawAdapter = WeapiMiniProgramWechatRawAdapter

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

/**
 * @description 小程序请求参数类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestOption = WechatMiniprogram.RequestOption

/**
 * @description 小程序请求方法类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestMethod = NonNullable<WeapiMiniProgramRequestOption['method']>

/**
 * @description 小程序请求任务类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestTask = WechatMiniprogram.RequestTask

/**
 * @description 小程序请求成功结果类型（宿主中立别名）
 */
export type WeapiMiniProgramRequestSuccessResult = WechatMiniprogram.RequestSuccessCallbackResult

/**
 * @description 小程序连接 WebSocket 参数类型（宿主中立别名）
 */
export type WeapiMiniProgramConnectSocketOption = WechatMiniprogram.ConnectSocketOption

/**
 * @description 小程序 WebSocket 任务类型（宿主中立别名）
 */
export type WeapiMiniProgramSocketTask = WechatMiniprogram.SocketTask

/**
 * @description 小程序系统信息类型（宿主中立别名）
 */
export type WeapiMiniProgramSystemInfo = WechatMiniprogram.SystemInfo

/**
 * @description 小程序更新管理器类型（宿主中立别名）
 */
export type WeapiMiniProgramUpdateManager = WechatMiniprogram.UpdateManager

/**
 * @description 小程序日志管理器类型（宿主中立别名）
 */
export type WeapiMiniProgramLogManager = WechatMiniprogram.LogManager

/**
 * @description 小程序视频上下文类型（宿主中立别名）
 */
export type WeapiMiniProgramVideoContext = WechatMiniprogram.VideoContext

/**
 * @description 小程序选择器查询类型（宿主中立别名）
 */
export type WeapiMiniProgramSelectorQuery = WechatMiniprogram.SelectorQuery

/**
 * @description 小程序蓝牙错误类型（宿主中立别名）
 */
export type WeapiMiniProgramBluetoothError = WechatMiniprogram.BluetoothError

/**
 * @description 小程序剪贴板读取结果类型（宿主中立别名）
 */
export type WeapiMiniProgramClipboardDataResult = WechatMiniprogram.GetClipboardDataSuccessCallbackOption
