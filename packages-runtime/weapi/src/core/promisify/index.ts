import type { WeapiMiniProgramWechatRawAdapter } from '../miniProgramTypes'
import type { WeapiNonPromisifiedMethodName } from '../nonPromisifiedMethods'

export type WeapiAdapter = Record<string, any>

/**
 * @description weapi Promise 的通用错误类型
 */
export interface WeapiError {
  errMsg: string
  errno?: number
}

/**
 * @description 保留拒绝原因类型的 Promise
 */
export interface WeapiPromise<TResult, TError = WeapiError> extends Promise<TResult> {
  then: <TResult1 = TResult, TResult2 = never>(
    onfulfilled?: ((value: TResult) => PromiseLike<TResult1> | TResult1) | null,
    onrejected?: ((reason: TError) => PromiseLike<TResult2> | TResult2) | null,
  ) => WeapiPromise<TResult1 | TResult2, TError>
  catch: <TResult2 = never>(
    onrejected?: ((reason: TError) => PromiseLike<TResult2> | TResult2) | null,
  ) => WeapiPromise<TResult | TResult2, TError>
  finally: (onfinally?: (() => void) | null) => WeapiPromise<TResult, TError>
}

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

type ExtractSuccessResult<T> = T extends { success?: (...args: infer A) => unknown } ? A[0] : void
type ExtractFailureResult<T> = 'fail' extends keyof T
  ? T extends { fail?: (...args: infer A) => unknown }
    ? A[0]
    : never
  : never
type IsAny<T> = 0 extends (1 & T) ? true : false
type NormalizeFailureResult<T> = IsAny<T> extends true
  ? WeapiError
  : unknown extends T
    ? WeapiError
    : [T] extends [never] ? WeapiError : T
type WechatErrorExtension<TAdapter> = TAdapter extends WeapiMiniProgramWechatRawAdapter
  ? Pick<WeapiError, 'errno'>
  : object
type PromisifyFailureResult<Option, TAdapter> = NormalizeFailureResult<ExtractFailureResult<Option>>
  & WechatErrorExtension<TAdapter>

type PromisifyOptionMethod<
  Prefix extends any[],
  Option extends object,
  Result,
  IsOptional extends boolean,
  TAdapter,
> = IsOptional extends true
  ? {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
      (...args: Prefix): WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
    }
  : {
      <TOption extends Option>(...args: [...Prefix, TOption]): HasCallbackOption<TOption> extends true
        ? Result
        : WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
    }

type NormalizePromisifyReturn<T, TAdapter> = T extends Promise<infer TResult>
  ? WeapiPromise<TResult, WeapiError & WechatErrorExtension<TAdapter>>
  : WeapiPromise<T, WeapiError & WechatErrorExtension<TAdapter>>
type NormalizeTupleArgs<Args extends any[]> = { [Key in keyof Args]-?: Args[Key] }
type DecomposeTrailingArg<Args extends any[]> = NormalizeTupleArgs<Args> extends [...infer Prefix, infer Last]
  ? { prefix: Prefix, last: Last }
  : never
type IsOptionalTrailingArg<Args extends any[], Prefix extends any[]> = Record<never, never> extends Pick<Args, Prefix['length']>
  ? true
  : false
type RequiredObjectKeys<T extends object> = {
  [Key in keyof T]-?: Pick<T, Key> extends Required<Pick<T, Key>> ? Key : never
}[keyof T]
type IsStructurallyOmittableObject<T> = T extends object
  ? RequiredObjectKeys<T> extends never
    ? true
    : false
  : false
type IsOmittableTrailingArg<Args extends any[], Prefix extends any[], Last>
  = IsOptionalTrailingArg<Args, Prefix> extends true
    ? true
    : IsStructurallyOmittableObject<NonNullable<Last>>

type PromisifyMethod<TMethod, TAdapter> = TMethod extends (...args: infer Args) => infer Result
  ? Args extends []
    ? (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
    : DecomposeTrailingArg<Args> extends {
      prefix: infer Prefix extends any[]
      last: infer Last
    }
      ? true extends HasCallbackKey<NonNullable<Last>>
        ? PromisifyOptionMethod<
          Prefix,
          NonNullable<Last>,
          Result,
          IsOmittableTrailingArg<Args, Prefix, Last>,
          TAdapter
        >
        : (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
      : (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
  : TMethod

export type WeapiPromisify<TAdapter extends WeapiAdapter> = {
  [Key in keyof TAdapter]: Key extends string
    ? Key extends `${string}Sync`
      ? TAdapter[Key]
      : Key extends WeapiNonPromisifiedMethodName
        ? TAdapter[Key]
        : Key extends `on${Capitalize<string>}` | `off${Capitalize<string>}`
          ? TAdapter[Key]
          : PromisifyMethod<TAdapter[Key], TAdapter>
    : TAdapter[Key]
}
