type PropMethod<T, TConstructor = any> = [T] extends
  | [((...args: any) => any) | undefined]
  ? { new (): TConstructor, (): T, readonly prototype: TConstructor }
  : never

export type PropConstructor<T = any>
  = | { new (...args: any[]): T & {} }
    | { (): T }
    | PropMethod<T>
export type PropType<T> = PropConstructor<T> | (PropConstructor<T> | null)[]
type Prop<T, D = T> = PropOptions<T, D> | PropType<T>
export type ComponentPropsOptions = Record<string, PropOptions<any> | PropType<any> | null>

export interface NativeTypeHint<T = any> {
  readonly __wevuNativeType?: T
}

export type NativePropsOptions = Record<string, WechatMiniprogram.Component.AllProperty | NativeTypeHint<any>>

export type NativePropType<
  T = any,
  C extends WechatMiniprogram.Component.ShortProperty = StringConstructor,
> = C & NativeTypeHint<T>

export type NativeTypedProperty<
  T = any,
  P extends WechatMiniprogram.Component.AllProperty = WechatMiniprogram.Component.AllProperty,
> = P & NativeTypeHint<T>

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  optionalTypes?: Array<WechatMiniprogram.Component.ShortProperty | PropConstructor<any>>
  /**
   * 默认值（对齐 Vue 的 `default`；会被赋给小程序 property 的 `value`）
   */
  default?: D | (() => D)
  /**
   * 小程序 `value` 的别名
   */
  value?: D | (() => D)
  observer?: string | ((newVal: T, oldVal: T, changedPath: Array<string | number>) => void)
  required?: boolean
}

type HasDefault<T>
  = T extends { default: infer D }
    ? D extends (() => undefined) | undefined
      ? false
      : true
    : T extends { value: infer V }
      ? V extends (() => undefined) | undefined
        ? false
        : true
      : false

type IsBooleanProp<T>
  = T extends { type?: infer U }
    ? IsBooleanProp<U>
    : T extends readonly any[]
      ? true extends IsBooleanProp<T[number]> ? true : false
      : T extends BooleanConstructor ? true : false

type RequiredKeys<T> = {
  [K in keyof T]:
  T[K] extends { required: true }
    ? K
    : HasDefault<T[K]> extends true
      ? K
      : IsBooleanProp<T[K]> extends true
        ? K
        : never
}[keyof T]

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>
type DefaultKeys<T> = {
  [K in keyof T]:
  HasDefault<T[K]> extends true
    ? K
    : IsBooleanProp<T[K]> extends true
      ? K
      : never
}[keyof T]

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N

export type InferPropType<O, NullAsAny = true>
  = [O] extends [null]
    ? NullAsAny extends true ? any : null
    : [O] extends [{ type: null | true }]
        ? any
        : [O] extends [ObjectConstructor | { type: ObjectConstructor }]
            ? Record<string, any>
            : [O] extends [BooleanConstructor | { type: BooleanConstructor }]
                ? boolean
                : [O] extends [DateConstructor | { type: DateConstructor }]
                    ? Date
                    : [O] extends [(infer U)[] | { type: (infer U)[] }]
                        ? U extends DateConstructor
                          ? Date | InferPropType<U, false>
                          : InferPropType<U, false>
                        : [O] extends [Prop<infer V, infer D>]
                            ? unknown extends V
                              ? keyof V extends never
                                ? IfAny<V, V, D>
                                : V
                              : V
                            : O

type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : never

type WidenLiteral<T>
  = T extends string
    ? string extends T
      ? string
      : IsUnion<T> extends true
        ? T
        : string
    : T extends number
      ? number extends T
        ? number
        : IsUnion<T> extends true
          ? T
          : number
      : T extends boolean
        ? boolean extends T
          ? boolean
          : IsUnion<T> extends true
            ? T
            : boolean
        : T

type NativeInferByCtor<C>
  = C extends readonly any[] ? NativeInferByCtor<C[number]>
    : C extends StringConstructor ? string
      : C extends NumberConstructor ? number
        : C extends BooleanConstructor ? boolean
          : C extends DateConstructor ? Date
            : C extends ArrayConstructor ? any[]
              : C extends ObjectConstructor ? Record<string, any>
                : C extends null ? any
                  : C extends PropConstructor<infer V> ? V
                    : any

type MergeNativeType<Base, V>
  = Base extends string
    ? Exclude<Extract<WidenLiteral<V>, string>, never> | (Extract<WidenLiteral<V>, string> extends never ? string : never)
    : Base extends number
      ? Exclude<Extract<WidenLiteral<V>, number>, never> | (Extract<WidenLiteral<V>, number> extends never ? number : never)
      : Base extends boolean
        ? Exclude<Extract<WidenLiteral<V>, boolean>, never> | (Extract<WidenLiteral<V>, boolean> extends never ? boolean : never)
        : Base

type InferNativeByOption<O extends { type?: any }>
  = O['type'] extends NativeTypeHint<infer THint>
    ? THint
    : O extends { value: infer V }
      ? MergeNativeType<NativeInferByCtor<O['type']>, V>
      : NativeInferByCtor<O['type']>

export type InferNativePropType<O>
  = O extends NativeTypeHint<infer T>
    ? T
    : O extends { type?: any }
      ? InferNativeByOption<O>
      : NativeInferByCtor<O>

export type InferNativeProps<P extends NativePropsOptions = NativePropsOptions> = {
  readonly [K in keyof P]?: InferNativePropType<P[K]>
}

export type InferProps<P extends ComponentPropsOptions = ComponentPropsOptions> = {
  [K in keyof Pick<P, RequiredKeys<P>>]:
  HasDefault<P[K]> extends true
    ? Exclude<InferPropType<P[K]>, undefined>
    : InferPropType<P[K]>
} & {
  [K in keyof Pick<P, OptionalKeys<P>>]?: InferPropType<P[K]>
}

export type ExtractPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = InferProps<P>
export type ExtractPublicPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = InferProps<P>
export type ExtractDefaultPropTypes<P extends ComponentPropsOptions = ComponentPropsOptions> = {
  [K in keyof Pick<P, DefaultKeys<P>>]: InferPropType<P[K]>
}
