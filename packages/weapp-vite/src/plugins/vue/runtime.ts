import type {
  ComputedDefinitions,
  MethodDefinitions,
} from 'wevu'
import { defineComponent } from 'wevu'

export interface WevuComponentOptions<D extends object = Record<string, any>, C extends ComputedDefinitions = ComputedDefinitions, M extends MethodDefinitions = MethodDefinitions> {
  data?: () => D
  computed?: C
  methods?: M
  watch?: any
  setup?: (...args: any[]) => any
  setupLifecycle?: 'created' | 'attached'
  properties?: Record<string, any>
  [key: string]: any
}

/**
 * 从 Vue SFC 的 options 创建 wevu 组件
 * 同时支持 Vue 2 风格（Options API）与 Vue 3 风格（Composition API）
 *
 * 始终使用 defineComponent（其内部会调用小程序的 Component()）。
 * 在微信小程序中，Component() 可以同时定义页面与组件。
 */
export function createWevuComponent(options: WevuComponentOptions) {
  const {
    properties,
    ...restOptions
  } = options

  // 将 properties 合并到小程序 options
  const mpOptions: Record<string, any> = {}
  if (properties) {
    mpOptions.properties = properties
  }

  // 合并其它选项
  const finalOptions = {
    ...restOptions,
    ...mpOptions,
  }

  // 始终使用 defineComponent
  defineComponent(finalOptions as any)
}

/**
 * 说明：Vue 3 风格的 props 声明（用于类型提示）
 */
export function defineProps<T extends Record<string, any>>(props: T): T {
  return props
}

/**
 * 说明：Vue 3 风格的 emits 声明（用于类型提示）
 */
export function defineEmits<T extends Record<string, any> | string[]>(emits: T): T {
  return emits
}
