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
  ? string extends keyof T
    ? false
    : number extends keyof T
      ? false
      : 'success' extends keyof T
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

declare const MissingCallbackResultKey: unique symbol
interface MissingCallbackResult {
  readonly [MissingCallbackResultKey]: never
}
type ExtractCallbackResult<T, Key extends PropertyKey, Fallback> = Key extends keyof T
  ? T extends { [CallbackKey in Key]?: (...args: infer A) => unknown }
    ? A[0]
    : unknown
  : Fallback
type ExtractSuccessResult<T> = ExtractCallbackResult<T, 'success', void>
type ExtractFailureResult<T> = ExtractCallbackResult<T, 'fail', MissingCallbackResult>
type ExtractCompleteResult<T> = ExtractCallbackResult<T, 'complete', void>
type NormalizeFailureResult<T> = [T] extends [MissingCallbackResult] ? WeapiError : T
type AddWechatErrorExtension<T, TAdapter> = TAdapter extends WeapiMiniProgramWechatRawAdapter
  ? unknown extends T ? T : T & Pick<WeapiError, 'errno'>
  : T
type PromisifyFailureResult<Option, TAdapter> = AddWechatErrorExtension<NormalizeFailureResult<ExtractFailureResult<Option>>, TAdapter>
type PromisifyCallbackOptions<Option extends object, TAdapter>
  = ('success' extends keyof Option
    ? { success?: (result: ExtractSuccessResult<Option>) => void }
    : object)
  & ('fail' extends keyof Option
    ? { fail?: (error: PromisifyFailureResult<Option, TAdapter>) => void }
    : object)
  & ('complete' extends keyof Option
    ? { complete?: (result: ExtractCompleteResult<Option>) => void }
    : object)
type PromisifyOption<Option extends object, TAdapter> = Omit<Option, 'success' | 'fail' | 'complete'>
  & PromisifyCallbackOptions<Option, TAdapter>
type PromisifyOptionWithoutCallbacks<Option extends object> = Omit<Option, 'success' | 'fail' | 'complete'>
type PromisifyCallbackReturn<Result, TOption> = HasCallbackOption<TOption> extends true
  ? Result extends Promise<any> ? void : Result
  : never

type PromisifyOptionMethod<
  Prefix extends any[],
  Option extends object,
  Result,
  IsOptional extends boolean,
  Suffix extends any[],
  TAdapter,
> = IsOptional extends true
  ? {
      <TOption extends PromisifyOption<Option, TAdapter>>(...args: [...Prefix, TOption, ...Suffix]): HasCallbackOption<TOption> extends true
        ? PromisifyCallbackReturn<Result, TOption>
        : WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
      (...args: [...Prefix, PromisifyOptionWithoutCallbacks<Option>, ...Suffix]): WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
      (...args: [...Prefix, ...Suffix]): WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
    }
  : {
      <TOption extends PromisifyOption<Option, TAdapter>>(...args: [...Prefix, TOption, ...Suffix]): HasCallbackOption<TOption> extends true
        ? PromisifyCallbackReturn<Result, TOption>
        : WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
      (...args: [...Prefix, PromisifyOptionWithoutCallbacks<Option>, ...Suffix]): WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
    }

type NormalizePromisifyReturn<T, TAdapter> = T extends Promise<infer TResult>
  ? WeapiPromise<TResult, AddWechatErrorExtension<WeapiError, TAdapter>>
  : WeapiPromise<T, AddWechatErrorExtension<WeapiError, TAdapter>>
type NormalizeTupleArgs<Args extends any[]> = { [Key in keyof Args]-?: Args[Key] }
type RequiredObjectKeys<T extends object> = {
  [Key in keyof T]-?: Pick<T, Key> extends Required<Pick<T, Key>> ? Key : never
}[keyof T]
type IsStructurallyOmittableObject<T> = T extends object
  ? RequiredObjectKeys<T> extends never
    ? true
    : false
  : false
type DecomposeTrailingArg<Args extends any[]> = NormalizeTupleArgs<Args> extends [...infer Prefix, infer Last]
  ? { prefix: Prefix, last: Last }
  : never
type IsOptionalTrailingArg<Args extends any[], Prefix extends any[]> = Record<never, never> extends Pick<Args, Prefix['length']> ? true : false
type IsOmittableTrailingArg<Args extends any[], Prefix extends any[], Last>
  = IsOptionalTrailingArg<Args, Prefix> extends true
    ? true
    : IsStructurallyOmittableObject<NonNullable<Last>>

type FindCallbackOption<Args extends any[], Prefix extends any[] = []> = Args extends [infer Head, ...infer Suffix]
  ? true extends HasCallbackKey<NonNullable<Head>>
    ? {
        prefix: Prefix
        option: NonNullable<Head>
        suffix: Suffix
        optional: undefined extends Head
          ? true
          : Suffix extends []
            ? IsStructurallyOmittableObject<NonNullable<Head>>
            : false
      }
    : FindCallbackOption<Suffix, [...Prefix, Head]>
  : never
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
          [],
          TAdapter
        >
        : [FindCallbackOption<Args>] extends [never]
            ? (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
            : FindCallbackOption<Args> extends {
              prefix: infer OptionPrefix extends any[]
              option: infer Option extends object
              suffix: infer Suffix extends any[]
              optional: infer IsOptional extends boolean
            }
              ? PromisifyOptionMethod<OptionPrefix, Option, Result, IsOptional, Suffix, TAdapter>
              : (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
      : (...args: Args) => NormalizePromisifyReturn<Result, TAdapter>
  : TMethod

type WechatCanvasComponent = WechatMiniprogram.Component.TrivialInstance | WechatMiniprogram.Page.TrivialInstance
interface PromisifyCanvasMethod<Option extends object, TAdapter> {
  <TOption extends PromisifyOption<Option, TAdapter>>(
    option: TOption,
    component?: WechatCanvasComponent,
  ): HasCallbackOption<TOption> extends true
    ? PromisifyCallbackReturn<void, TOption>
    : WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
  (
    option: PromisifyOptionWithoutCallbacks<Option>,
    component?: WechatCanvasComponent,
  ): WeapiPromise<ExtractSuccessResult<Option>, PromisifyFailureResult<Option, TAdapter>>
}

export type WeapiPromisify<TAdapter extends WeapiAdapter> = {
  [Key in keyof TAdapter]: Key extends string
    ? Key extends `${string}Sync`
      ? TAdapter[Key]
      : Key extends WeapiNonPromisifiedMethodName
        ? TAdapter[Key]
        : Key extends `on${Capitalize<string>}` | `off${Capitalize<string>}`
          ? TAdapter[Key]
          : Key extends 'canvasGetImageData'
            ? TAdapter extends WeapiMiniProgramWechatRawAdapter
              ? PromisifyCanvasMethod<WechatMiniprogram.CanvasGetImageDataOption, TAdapter>
              : PromisifyMethod<TAdapter[Key], TAdapter>
            : Key extends 'canvasPutImageData'
              ? TAdapter extends WeapiMiniProgramWechatRawAdapter
                ? PromisifyCanvasMethod<WechatMiniprogram.CanvasPutImageDataOption, TAdapter>
                : PromisifyMethod<TAdapter[Key], TAdapter>
              : Key extends 'canvasToTempFilePath'
                ? TAdapter extends WeapiMiniProgramWechatRawAdapter
                  ? PromisifyCanvasMethod<WechatMiniprogram.CanvasToTempFilePathOption, TAdapter>
                  : PromisifyMethod<TAdapter[Key], TAdapter>
                : PromisifyMethod<TAdapter[Key], TAdapter>
    : TAdapter[Key]
}
