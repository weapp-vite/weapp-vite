import type { WeapiCrossPlatformMethodDocs } from './types/methodDocs'

/// <reference types="miniprogram-api-typings" />
/// <reference types="@mini-types/alipay" />
/// <reference types="@douyin-microapp/typings" />
export type WeapiAdapter = Record<string, any>

/**
 * @description 微信小程序 API 原始适配器类型
 */
export type WeapiWxRawAdapter = WechatMiniprogram.Wx

/**
 * @description 支付宝小程序 API 原始适配器类型
 */
export type WeapiAlipayRawAdapter = typeof my

/**
 * @description 抖音小程序 API 原始适配器类型
 */
export type WeapiDouyinRawAdapter = typeof tt

type MergeAdapters<Primary extends WeapiAdapter, Secondary extends WeapiAdapter>
  = Primary & Omit<Secondary, keyof Primary>

/**
 * @description weapi 对齐后的跨平台原始 API 类型
 *
 * @generated weapi-platform-matrix:start
 * | 平台 | 全局对象 | 类型来源 | 对齐状态 |
 * | --- | --- | --- | --- |
 * | 微信小程序 | `wx` | `miniprogram-api-typings` | ✅ 全量 |
 * | 支付宝小程序 | `my` | `@mini-types/alipay` | ✅ 全量 |
 * | 抖音小程序 | `tt` | `@douyin-microapp/typings` | ✅ 全量 |
 * | 其他平台（swan/jd/xhs 等） | 运行时宿主对象 | 运行时透传 | ⚠️ 按宿主能力支持 |
 * @generated weapi-platform-matrix:end
 */
export type WeapiCrossPlatformRawAdapter = MergeAdapters<
  MergeAdapters<WeapiWxRawAdapter, WeapiAlipayRawAdapter>,
  WeapiDouyinRawAdapter
>

type HasCallbackKey<T> = T extends object
  ? 'success' extends keyof T
    ? true
    : 'fail' extends keyof T
      ? true
      : 'complete' extends keyof T
        ? true
        : false
  : false

type HasCallbackOption<T> = T extends { success: unknown }
  ? true
  : T extends { fail: unknown }
    ? true
    : T extends { complete: unknown }
      ? true
      : false

type ExtractSuccessResult<T> = T extends { success?: (...args: infer A) => unknown }
  ? A[0]
  : void

type PromisifyOptionMethod<
  Prefix extends any[],
  Option extends object,
  Result,
  IsOptional extends boolean,
> = IsOptional extends true
  ? {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : Promise<ExtractSuccessResult<Option>>
      (...args: Prefix): Promise<ExtractSuccessResult<Option>>
    }
  : {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : Promise<ExtractSuccessResult<Option>>
    }

type NormalizePromisifyReturn<T> = T extends Promise<any> ? T : Promise<T>

type NormalizeTupleArgs<Args extends any[]> = {
  [Key in keyof Args]-?: Args[Key]
}

type DecomposeTrailingArg<Args extends any[]> = NormalizeTupleArgs<Args> extends [...infer Prefix, infer Last]
  ? {
      prefix: Prefix
      last: Last
    }
  : never

type IsOptionalTrailingArg<Args extends any[], Prefix extends any[]> = Record<never, never> extends Pick<Args, Prefix['length']>
  ? true
  : false

type PromisifyMethod<TMethod> = TMethod extends (...args: infer Args) => infer Result
  ? Args extends []
    ? (...args: Args) => NormalizePromisifyReturn<Result>
    : DecomposeTrailingArg<Args> extends {
      prefix: infer Prefix extends any[]
      last: infer Last
    }
      ? true extends HasCallbackKey<NonNullable<Last>>
        ? PromisifyOptionMethod<Prefix, NonNullable<Last>, Result, IsOptionalTrailingArg<Args, Prefix>>
        : (...args: Args) => NormalizePromisifyReturn<Result>
      : (...args: Args) => NormalizePromisifyReturn<Result>
  : TMethod

export type WeapiPromisify<TAdapter extends WeapiAdapter> = {
  [Key in keyof TAdapter]: Key extends string
    ? Key extends `${string}Sync`
      ? TAdapter[Key]
      : Key extends `on${Capitalize<string>}` | `off${Capitalize<string>}`
        ? TAdapter[Key]
        : PromisifyMethod<TAdapter[Key]>
    : TAdapter[Key]
}

/**
 * @description 微信小程序 API 适配器类型
 */
export type WeapiWxAdapter = WeapiPromisify<WeapiWxRawAdapter>

/**
 * @description 支付宝小程序 API 适配器类型
 */
export type WeapiAlipayAdapter = WeapiPromisify<WeapiAlipayRawAdapter>

/**
 * @description 抖音小程序 API 适配器类型
 */
export type WeapiDouyinAdapter = WeapiPromisify<WeapiDouyinRawAdapter>

/**
 * @description weapi 默认导出的跨平台 API 适配器类型
 */
export type WeapiCrossPlatformAdapter = WeapiPromisify<WeapiCrossPlatformRawAdapter>

/**
 * @description weapi 核心映射 API 的平台支持度说明
 */
type WeapiMethodDocOverlay<TAdapter extends WeapiAdapter> = TAdapter extends WeapiCrossPlatformRawAdapter
  ? WeapiCrossPlatformMethodDocs
  : object

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
