/* eslint-disable ts/no-unsafe-function-type -- 允许使用 Function 类型 */
/// <reference types="miniprogram-api-typings" />

import type { Ref } from './reactivity'
import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InferProps, MethodDefinitions } from './runtime'

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type LooseRequired<T> = {
  [P in keyof (T & Required<T>)]: T[P]
}

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

type ComponentObjectPropsOptions = ComponentPropsOptions
type ExtractPropTypes<P extends ComponentObjectPropsOptions> = InferProps<P>

type DefineProps<T, BKeys extends keyof T> = Readonly<T> & {
  readonly [K in BKeys]-?: boolean
}

type BooleanKey<T, K extends keyof T = keyof T> = K extends any
  ? T[K] extends boolean | undefined
    ? T[K] extends never | undefined
      ? never
      : K
    : never
  : never

/**
 * wevu + Volar 类型检查使用的 script-setup 宏。
 *
 * 这些只是类型声明，运行时不存在。
 * 请确保 `vueCompilerOptions.lib = "wevu"`，让 Volar 从本文件解析它们。
 *
 * 常见搭配示例（仅类型层）：
 * - defineProps + withDefaults：声明 Props 并补默认值
 * - defineEmits：约束事件与负载类型
 * - defineSlots：约束插槽与插槽参数
 * - defineModel：声明双向绑定字段
 */
/**
 * defineProps 数组语法。
 *
 * @example
 * ```ts
 * const props = defineProps(['title', 'count'])
 * const { title } = defineProps(['title'])
 * ```
 */
export declare function defineProps<PropNames extends string = string>(
  props: PropNames[],
): Prettify<Readonly<{
  [key in PropNames]?: any
}>>
/**
 * defineProps 运行时 props 配置。
 *
 * @example
 * ```ts
 * const props = defineProps({
 *   title: String,
 *   count: Number,
 *   active: Boolean,
 *   color: {
 *     type: String,
 *     default: 'red',
 *   },
 * })
 * ```
 */
export declare function defineProps<PP extends ComponentObjectPropsOptions = ComponentObjectPropsOptions>(
  props: PP,
): Prettify<Readonly<ExtractPropTypes<PP>>>
/**
 * defineProps 泛型类型声明。
 *
 * @example
 * ```ts
 * const props = defineProps<{
 *   title?: string
 *   count: number
 *   active?: boolean
 * }>()
 *
 * const props2 = defineProps<{
 *   size?: 'sm' | 'md' | 'lg'
 * }>()
 * ```
 */
export declare function defineProps<TypeProps>(): DefineProps<LooseRequired<TypeProps>, BooleanKey<TypeProps>>

type NotUndefined<T> = T extends undefined ? never : T
type MappedOmit<T, K extends keyof any> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}
type InferDefaults<T> = {
  [K in keyof T]?: InferDefault<T, T[K]>
}
type NativeType = null | undefined | number | string | boolean | symbol | Function
type InferDefault<P, T> = ((props: P) => T & {}) | (T extends NativeType ? T : never)
type PropsWithDefaults<T, Defaults extends InferDefaults<T>, BKeys extends keyof T> = T extends unknown
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

/**
 * withDefaults 为 defineProps 指定默认值（仅类型层）。
 * 默认值会影响可选/必选推导，但不生成运行时代码。
 *
 * @example
 * ```ts
 * const props = withDefaults(defineProps<{
 *   title?: string
 *   size?: 'sm' | 'md' | 'lg'
 * }>(), {
 *   title: 'Empty',
 *   size: 'md',
 * })
 * ```
 */
export declare function withDefaults<T, BKeys extends keyof T, Defaults extends InferDefaults<T>>(
  props: DefineProps<T, BKeys>,
  defaults: Defaults,
): PropsWithDefaults<T, Defaults, BKeys>

type UnionToIntersection<U> = (U extends any ? (arg: U) => any : never) extends
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
type ShortEmits<T extends Record<string, any>> = UnionToIntersection<RecordToUnion<{
  [K in keyof T]: (evt: K, ...args: T[K]) => void
}>>

/**
 * defineEmits 字符串数组或映射写法。
 *
 * @example
 * ```ts
 * const emit = defineEmits(['change', 'open'])
 * emit('change', { id: 1 })
 *
 * const emit2 = defineEmits({
 *   change: (payload: { id: number }) => true,
 *   close: null,
 * })
 * emit2('change', { id: 2 })
 *
 * const emit3 = defineEmits(['tap', 'confirm'])
 * emit3('confirm')
 * ```
 */
export declare function defineEmits<EE extends string = string>(
  emits?: EE[],
): EmitFn<EE[]>
export declare function defineEmits<E extends EmitsOptions = EmitsOptions>(
  emits?: E,
): EmitFn<E>
/**
 * defineEmits 显式签名写法。
 *
 * @example
 * ```ts
 * const emit = defineEmits<(e: 'save' | 'cancel', id?: number) => void>()
 * emit('save', 1)
 * ```
 */
export declare function defineEmits<T extends ComponentTypeEmits>(): T extends (...args: any[]) => any ? T : ShortEmits<T>

/**
 * defineExpose 向父级 ref 暴露成员。
 * 仅影响类型提示，不会生成运行时代码。
 *
 * @example
 * ```ts
 * defineExpose({
 *   focus,
 *   reset,
 * })
 * ```
 */
export declare function defineExpose<T extends Record<string, any> = Record<string, any>>(
  exposed?: T,
): void

type ScriptSetupDefineOptions<
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

/**
 * defineOptions 设置组件选项。
 * 适合声明组件名、样式隔离等静态选项（仅 `<script setup>` 宏）。
 *
 * 仅用于无法通过 Composition API / 其他宏表达的选项，如：
 * - `name`
 * - `inheritAttrs`
 * - 小程序 `options`（multipleSlots/styleIsolation/etc）
 *
 * 注意：`props/emits/expose/slots` 应分别使用对应宏声明。
 *
 * @example
 * ```ts
 * defineOptions({
 *   name: 'EmptyState',
 *   inheritAttrs: false,
 *   options: {
 *     multipleSlots: true,
 *   },
 * })
 * ```
 */
export declare function defineOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options?: ScriptSetupDefineOptions<D, C, M>): void

/**
 * defineSlots 声明 slots 类型。
 * 用于限定插槽名称与插槽参数结构。
 *
 * 注意：在小程序运行时，`useSlots()` 当前仅返回空对象兜底；
 * 因此 `defineSlots()` 主要提供类型约束，不等价于 Web Vue 的运行时 slot 函数语义。
 *
 * @example
 * ```ts
 * const slots = defineSlots<{
 *   default?: (props: { text: string }) => any
 *   footer?: () => any
 * }>()
 * ```
 */
export declare function defineSlots<T extends Record<string, any> = Record<string, any>>(): T

/**
 * defineModel 声明 v-model 绑定（weapp 变体）。
 * 支持默认字段与自定义字段名，并兼容 Vue 3 的 tuple + modifiers 形态。
 *
 * @example
 * ```ts
 * const modelValue = defineModel<string>()
 * const [title, modifiers] = defineModel<string, 'trim' | 'uppercase'>()
 * const checked = defineModel<boolean>('checked')
 * const count = defineModel<number>('count', { default: 0 })
 * ```
 */
export type DefineModelModifiers<M extends PropertyKey = string> = Record<M, true | undefined>
export type ModelRef<T, M extends PropertyKey = string, G = T, S = T> = Ref<G, S> & [ModelRef<T, M, G, S>, DefineModelModifiers<M>]

export interface DefineModelTransformOptions<T, M extends PropertyKey = string, G = T, S = T> {
  get?: (value: T, modifiers: DefineModelModifiers<M>) => G
  set?: (value: S, modifiers: DefineModelModifiers<M>) => T
}

type DefineModelBaseOptions<T, M extends PropertyKey = string, G = T, S = T> = Record<string, any> & DefineModelTransformOptions<T, M, G, S>
type DefineModelRequiredOptions<T> = { default: T | (() => T) } | { required: true }

export declare function defineModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  options: DefineModelBaseOptions<T, M, G, S> & DefineModelRequiredOptions<T>,
): ModelRef<T, M, G, S>
export declare function defineModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  name: string,
  options: DefineModelBaseOptions<T, M, G, S> & DefineModelRequiredOptions<T>,
): ModelRef<T, M, G, S>
export declare function defineModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  options?: DefineModelBaseOptions<T | undefined, M, G | undefined, S | undefined>,
): ModelRef<T | undefined, M, G | undefined, S | undefined>
export declare function defineModel<T = any, M extends PropertyKey = string, G = T, S = T>(
  name?: string,
  options?: DefineModelBaseOptions<T | undefined, M, G | undefined, S | undefined>,
): ModelRef<T | undefined, M, G | undefined, S | undefined>
