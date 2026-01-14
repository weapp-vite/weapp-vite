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

export type EmitsOptions = Record<string, ((...args: any[]) => any) | null> | string[]

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
): (event: EE, detail?: any) => void
export declare function defineEmits<E extends Record<string, ((...args: any[]) => any) | null>>(
  emits?: E,
): (event: keyof E & string, detail?: any) => void
/**
 * defineEmits 显式签名写法。
 *
 * @example
 * ```ts
 * const emit = defineEmits<(e: 'save' | 'cancel', id?: number) => void>()
 * emit('save', 1)
 * ```
 */
export declare function defineEmits<T extends (...args: any[]) => any>(): T

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
   * props should be defined via defineProps().
   */
  props?: never
  /**
   * emits should be defined via defineEmits().
   */
  emits?: never
  /**
   * expose should be defined via defineExpose().
   */
  expose?: never
  /**
   * slots should be defined via defineSlots().
   */
  slots?: never
  /**
   * Mini-program Component options (multipleSlots/styleIsolation/etc).
   */
  options?: WechatMiniprogram.Component.ComponentOptions
}

/**
 * defineOptions 设置组件选项。
 * 适合声明组件名、样式隔离等静态选项（仅 <script setup> 宏）。
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
 * 支持默认字段与自定义字段名。
 *
 * @example
 * ```ts
 * const modelValue = defineModel<string>()
 * const checked = defineModel<boolean>('checked')
 * const count = defineModel<number>('count', { default: 0 })
 * ```
 */
export declare function defineModel<T = any>(
  name?: string,
  options?: Record<string, any>,
): Ref<T | undefined>
