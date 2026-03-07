/// <reference types="miniprogram-api-typings" />

import type {
  BooleanKey,
  ComponentTypeEmits,
  DefineProps,
  DefinePropsFromArray,
  DefinePropsFromOptions,
  EmitFn,
  EmitsOptions,
  InferDefaults,
  PropsWithDefaults,
  ScriptSetupDefineOptions,
  ShortEmits,
} from './macros/shared'
import type { Ref } from './reactivity'
import type { ComponentPropsOptions, ComputedDefinitions, MethodDefinitions } from './runtime'

export type {
  ComponentTypeEmits,
  EmitFn,
  EmitsOptions,
}

/**
 * defineProps 声明（类型层宏）。
 */
export declare function defineProps<PropNames extends string = string>(
  props: PropNames[],
): DefinePropsFromArray<PropNames>
export declare function defineProps<PP extends ComponentPropsOptions = ComponentPropsOptions>(
  props: PP,
): DefinePropsFromOptions<PP>
export declare function defineProps<TypeProps>(): DefineProps<TypeProps, BooleanKey<TypeProps>>

/**
 * withDefaults 为 defineProps 声明默认值（类型层）。
 */
export declare function withDefaults<T, BKeys extends keyof T, Defaults extends InferDefaults<T>>(
  props: DefineProps<T, BKeys>,
  defaults: Defaults,
): PropsWithDefaults<T, Defaults, BKeys>

/**
 * defineEmits 声明（类型层宏）。
 */
export declare function defineEmits<EE extends string = string>(
  emits?: EE[],
): EmitFn<EE[]>
export declare function defineEmits<E extends EmitsOptions = EmitsOptions>(
  emits?: E,
): EmitFn<E>
export declare function defineEmits<T extends ComponentTypeEmits>(): T extends (...args: any[]) => any ? T : ShortEmits<T>

/**
 * defineExpose 向父级 ref 暴露成员（仅类型层）。
 */
export declare function defineExpose<T extends Record<string, any> = Record<string, any>>(
  exposed?: T,
): void

/**
 * defineOptions 设置 `<script setup>` 组件选项（仅类型层）。
 */
export declare function defineOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options?: ScriptSetupDefineOptions<D, C, M> & {
  options?: WechatMiniprogram.Component.ComponentOptions
}): void

/**
 * defineSlots 声明 slots 类型（仅类型层）。
 */
export declare function defineSlots<T extends Record<string, any> = Record<string, any>>(): T

/**
 * defineModel 声明 v-model 绑定（类型层宏）。
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
