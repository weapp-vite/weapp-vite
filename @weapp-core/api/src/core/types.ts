import type {
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
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
  WeapiMiniProgramWxRawAdapter,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWxRawAdapter,
} from './miniProgramTypes'
import type {
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDouyinRawAdapter,
  WeapiMiniProgramCrossPlatformRawAdapter,
} from './platformAdapters'
import type { WeapiAdapter, WeapiPromisify } from './promisify'
import type { WeapiCrossPlatformMethodDocs } from './types/methodDocs'

/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />
export type {
  WeapiAlipayMiniProgramRawAdapterSource,
  WeapiAlipayRawAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiDefaultMiniProgramRawAdapterSource,
  WeapiDouyinRawAdapter,
  WeapiMiniProgramAlipayRawAdapter,
  WeapiMiniProgramBluetoothError,
  WeapiMiniProgramClipboardDataResult,
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramCrossPlatformRawAdapter,
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
  WeapiMiniProgramWxRawAdapter,
  WeapiTtMiniProgramRawAdapterSource,
  WeapiWechatMiniProgramRawAdapterSource,
  WeapiWxRawAdapter,
}
export type { WeapiAdapter, WeapiError, WeapiPromise, WeapiPromisify } from './promisify'

/**
 * @description 微信小程序 API 适配器类型
 */
export type WeapiWxAdapter = WeapiPromisify<WeapiWxRawAdapter>

/**
 * @description 小程序主适配器类型（当前以微信 typings 作为基准）
 */
export type WeapiMiniProgramAdapter = WeapiPromisify<WeapiMiniProgramRawAdapter>

/**
 * @description 微信小程序 API 适配器类型（宿主中立别名）
 */
export type WeapiMiniProgramWxAdapter = WeapiPromisify<WeapiMiniProgramWxRawAdapter>

/**
 * @description 支付宝小程序 API 适配器类型
 */
export type WeapiMiniProgramAlipayAdapter = WeapiPromisify<WeapiMiniProgramAlipayRawAdapter>

/**
 * @description 支付宝小程序 API 适配器类型
 */
export type WeapiAlipayAdapter = WeapiMiniProgramAlipayAdapter

/**
 * @description 抖音小程序 API 适配器类型
 */
export type WeapiMiniProgramDouyinAdapter = WeapiPromisify<WeapiMiniProgramDouyinRawAdapter>

/**
 * @description 抖音小程序 API 适配器类型
 */
export type WeapiDouyinAdapter = WeapiMiniProgramDouyinAdapter

/**
 * @description weapi 默认导出的跨平台 API 适配器类型
 */
export type WeapiMiniProgramCrossPlatformAdapter = WeapiPromisify<WeapiMiniProgramCrossPlatformRawAdapter>

/**
 * @description weapi 默认导出的跨平台 API 适配器类型
 */
export type WeapiCrossPlatformAdapter = WeapiMiniProgramCrossPlatformAdapter

/**
 * @description weapi 核心映射 API 的平台支持度说明
 */
type WeapiMethodDocOverlay<TAdapter extends WeapiAdapter> = TAdapter extends WeapiCrossPlatformRawAdapter
  ? WeapiCrossPlatformMethodDocs
  : object

export type WeapiNetworkOverflowPolicy = 'queue' | 'strict'

export interface WeapiNetworkOptions {
  /**
   * @description 并发溢出策略：`queue` 为排队执行，`strict` 为超限立即失败
   */
  overflowPolicy?: WeapiNetworkOverflowPolicy
  /**
   * @description 队列模式下的最大排队数（默认 100）
   */
  maxQueueSize?: number
}

export interface CreateWeapiOptions<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter> {
  /**
   * @description 手动指定平台适配器（优先级高于自动探测）
   */
  adapter?: TAdapter
  /**
   * @description 手动指定平台名称
   */
  platform?: string
  /**
   * @description 严格兼容模式（兼容字段）：当前版本默认已关闭通用 fallback，该选项保留向后兼容
   */
  strictCompatibility?: boolean
  /**
   * @description 网络请求策略配置
   */
  network?: WeapiNetworkOptions
}

export type WeapiSupportLevel = 'native' | 'mapped' | 'fallback' | 'unsupported'

export interface WeapiMethodSupportQueryOptions {
  /**
   * @description 是否按语义对齐能力判断（仅 `native/mapped` 视为支持）
   */
  semantic?: boolean
}

export interface WeapiResolvedTarget {
  /**
   * @description 输入的微信命名 API
   */
  method: string
  /**
   * @description 当前平台最终调用的目标 API 名称
   */
  target: string
  /**
   * @description 当前平台标识
   */
  platform?: string
  /**
   * @description 是否发生了命名映射（method !== target）
   */
  mapped: boolean
  /**
   * @description 当前适配器上是否存在可调用的目标方法
   */
  supported: boolean
  /**
   * @description 当前支持级别：直连、显式映射、fallback（保留状态）或不支持
   */
  supportLevel: WeapiSupportLevel
  /**
   * @description 是否语义对齐（仅 native/mapped 为 true）
   */
  semanticAligned: boolean
}

export type WeapiInstance<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter> = WeapiPromisify<TAdapter> & WeapiMethodDocOverlay<TAdapter> & {
  /**
   * @description 当前平台标识
   */
  readonly platform?: string
  /**
   * @description 获取当前适配器实例
   */
  getAdapter: () => TAdapter | undefined
  /**
   * @description 手动替换平台适配器
   */
  setAdapter: (adapter?: TAdapter, platform?: string) => void
  /**
   * @description 获取原始平台对象
   */
  readonly raw?: TAdapter
  /**
   * @description 解析微信命名 API 在当前平台的目标方法信息
   */
  resolveTarget: (method: string) => WeapiResolvedTarget
  /**
   * @description 判断微信命名 API 在当前平台是否可调用
   */
  supports: (method: string, options?: WeapiMethodSupportQueryOptions) => boolean
}
