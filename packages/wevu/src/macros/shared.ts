import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InferProps, MethodDefinitions } from '../runtime'

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

type ComponentObjectPropsOptions = ComponentPropsOptions
type ExtractPropTypes<P extends ComponentObjectPropsOptions> = InferProps<P>

export type DefineProps<T, BKeys extends keyof T> = Readonly<T> & {
  readonly [K in BKeys]-?: boolean
}

export type BooleanKey<T, K extends keyof T = keyof T> = K extends any
  ? T[K] extends boolean | undefined
    ? T[K] extends never | undefined
      ? never
      : K
    : never
  : never

export type DefinePropsFromArray<PropNames extends string = string> = Prettify<Readonly<{
  [key in PropNames]?: any
}>>

export type DefinePropsFromOptions<PP extends ComponentObjectPropsOptions = ComponentObjectPropsOptions> = Prettify<Readonly<ExtractPropTypes<PP>>>

type NotUndefined<T> = T extends undefined ? never : T
type MappedOmit<T, K extends keyof any> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}
export type InferDefaults<T> = {
  [K in keyof T]?: InferDefault<T, T[K]>
}
type NativeType = null | undefined | number | string | boolean | symbol | ((...args: any[]) => any)
type InferDefault<P, T> = ((props: P) => T & {}) | (T extends NativeType ? T : never)

export type PropsWithDefaults<T, Defaults extends InferDefaults<T>, BKeys extends keyof T> = T extends unknown
  ? Readonly<MappedOmit<T, keyof Defaults>> & {
    readonly [K in keyof Defaults as K extends keyof T ? K : never]-?: K extends keyof T
      ? Defaults[K] extends undefined
        ? IfAny<Defaults[K], NotUndefined<T[K]>, T[K]>
        : NotUndefined<T[K]>
      : never
  } & {
    readonly [K in BKeys]-?: K extends keyof Defaults
      ? Defaults[K] extends undefined
        ? boolean | undefined
        : boolean
      : boolean
  }
  : never

export type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends
(arg: infer I) => any
  ? I
  : never

type ObjectEmitsOptions = Record<string, ((...args: any[]) => any) | null>
export type EmitsOptions = ObjectEmitsOptions | string[]
/* eslint-disable ts/no-empty-object-type -- 对齐 Vue 官方 EmitFn 判定逻辑，使用 {} extends Options 判断空对象分支。 */
export type EmitFn<Options = ObjectEmitsOptions, Event extends keyof Options = keyof Options> = Options extends Array<infer V>
  ? (event: V, ...args: any[]) => void
  : {} extends Options
      ? (event: string, ...args: any[]) => void
      : UnionToIntersection<{
        [K in Event]: Options[K] extends (...args: infer Args) => any
          ? (event: K, ...args: Args) => void
          : Options[K] extends any[]
            ? (event: K, ...args: Options[K]) => void
            : (event: K, ...args: any[]) => void
      }[Event]>
/* eslint-enable ts/no-empty-object-type */

export type ComponentTypeEmits = ((...args: any[]) => any) | Record<string, any>
type RecordToUnion<T extends Record<string, any>> = T[keyof T]
export type ShortEmits<T extends Record<string, any>> = UnionToIntersection<RecordToUnion<{
  [K in keyof T]: (evt: K, ...args: T[K]) => void
}>>

export type ScriptSetupDefineOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> = Omit<DefineComponentOptions<ComponentPropsOptions, D, C, M>, 'props' | 'options'> & {
  /**
   * props 必须通过 defineProps() 声明。
   */
  props?: never
  /**
   * emits 必须通过 defineEmits() 声明。
   */
  emits?: never
  /**
   * expose 必须通过 defineExpose() 声明。
   */
  expose?: never
  /**
   * slots 必须通过 defineSlots() 声明。
   */
  slots?: never
  /**
   * 小程序 Component 选项（multipleSlots/styleIsolation 等）。
   */
  options?: WechatMiniprogram.Component.ComponentOptions
  /**
   * setup 执行时机（默认 attached）。
   */
  setupLifecycle?: 'created' | 'attached'
}
