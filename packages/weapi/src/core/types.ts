/// <reference types="miniprogram-api-typings" />
export type WeapiAdapter = Record<string, any>

/**
 * @description 微信小程序 API 原始适配器类型
 */
export type WeapiWxRawAdapter = WechatMiniprogram.Wx

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

type PromisifyMethod<TMethod> = TMethod extends (...args: infer Args) => infer Result
  ? Args extends []
    ? (...args: Args) => Promise<Result>
    : Args extends [...infer Prefix, infer Last]
      ? true extends HasCallbackKey<NonNullable<Last>>
        ? PromisifyOptionMethod<Prefix, NonNullable<Last>, Result, undefined extends Last ? true : false>
        : (...args: Args) => Promise<Result>
      : (...args: Args) => Promise<Result>
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

export interface CreateWeapiOptions<TAdapter extends WeapiAdapter = WeapiWxRawAdapter> {
  /**
   * @description 手动指定平台适配器（优先级高于自动探测）
   */
  adapter?: TAdapter
  /**
   * @description 手动指定平台名称
   */
  platform?: string
}

export type WeapiInstance<TAdapter extends WeapiAdapter = WeapiWxRawAdapter> = WeapiPromisify<TAdapter> & {
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
}
