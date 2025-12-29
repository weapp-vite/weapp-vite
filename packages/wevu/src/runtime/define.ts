import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
} from './types'
import { isReactive, isRef, toRaw } from '../reactivity'
import { createApp } from './app'
import { registerComponent, runSetupFunction } from './register'

/**
 * defineComponent 返回的组件定义描述，用于手动注册或高级用法。
 */
export interface ComponentDefinition<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
  /**
   * 内部 runtime app（高级能力使用），不对外暴露正式 API。
   * @internal
   */
  __wevu_runtime: import('./types').RuntimeApp<D, C, M>

  /**
   * 内部选项快照（高级能力使用），包含 data/computed/methods 等。
   * @internal
   */
  __wevu_options: {
    data: () => D
    computed: C
    methods: M
    watch: Record<string, any> | undefined
    setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
    mpOptions: Record<string, any>
    features?: DefineComponentOptions<ComponentPropsOptions, D, C, M>['features']
  }
}

/**
 * 按 Vue 3 风格定义一个小程序组件/页面。
 *
 * - 统一注册为 `Component()`
 *
 * @param options 组件定义项
 * @returns 可手动注册的组件定义
 *
 * @example
 * ```ts
 * defineComponent({
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     onMounted(() => console.log('mounted'))
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * defineComponent({
 *   features: { listenPageScroll: true },
 *   setup() {
 *     onPageScroll(() => {})
 *   }
 * })
 * ```
 */
export function defineComponent<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options: DefineComponentOptions<P, D, C, M>): ComponentDefinition<D, C, M> {
  const {
    features,
    data,
    computed,
    methods,
    watch,
    setup,
    props,
    ...mpOptions
  } = options

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
  })

  // setup 包装：注入 props/context 后应用到 runtime/state/methods
  const setupWrapper = (ctx: any) => {
    const result = runSetupFunction(setup, ctx?.props ?? {}, ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }

  // 保存供手动注册使用的选项
  const mpOptionsWithProps = normalizeProps(mpOptions, props)

  const componentOptions = {
    data: data as () => D,
    computed: computed as C,
    methods: methods as M,
    watch,
    setup: setupWrapper,
    mpOptions: mpOptionsWithProps,
    features,
  }

  registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptionsWithProps, features)

  // 返回组件定义，便于外部自行注册
  return {
    __wevu_runtime: runtimeApp,
    __wevu_options: componentOptions,
  }
}

function applySetupResult(runtime: any, _target: any, result: any) {
  const methods = runtime?.methods ?? Object.create(null)
  const state = runtime?.state ?? Object.create(null)
  const rawState = isReactive(state) ? toRaw(state) : state
  if (runtime && !runtime.methods) {
    try {
      runtime.methods = methods
    }
    catch {
      // 若 runtime 被标记只读则忽略（保持兼容）
    }
  }
  if (runtime && !runtime.state) {
    try {
      runtime.state = state
    }
    catch {
      // 若 runtime 被标记只读则忽略（保持兼容）
    }
  }
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      ;(methods as any)[key] = (...args: any[]) => (val as any).apply(runtime?.proxy ?? runtime, args)
    }
    else {
      // script setup / setup() 里可能会把当前小程序实例（getCurrentInstance()）等非可序列化对象返回出来。
      // 这些对象不应进入 setData 快照（否则可能导致深度遍历 + 栈溢出），但仍允许在 JS 侧读取。
      if (val === _target || !shouldExposeInSnapshot(val)) {
        try {
          Object.defineProperty(rawState, key, {
            value: val,
            configurable: true,
            enumerable: false,
            writable: true,
          })
        }
        catch {
          ;(state as any)[key] = val
        }
      }
      else {
        ;(state as any)[key] = val
      }
    }
  })
  if (runtime) {
    runtime.methods = runtime.methods ?? methods
    runtime.state = runtime.state ?? state
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function shouldExposeInSnapshot(value: unknown): boolean {
  if (value == null) {
    return true
  }
  if (typeof value !== 'object') {
    return true
  }
  if (isRef(value) || isReactive(value)) {
    return true
  }
  if (Array.isArray(value)) {
    return true
  }
  return isPlainObject(value)
}

/**
 * 从 Vue SFC 选项创建 wevu 组件，供 weapp-vite 编译产物直接调用的兼容入口。
 *
 * @param options 组件选项，可能包含小程序特有的 properties
 */
export function createWevuComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<ComponentPropsOptions, D, C, M> & { properties?: Record<string, any> },
): void {
  const {
    properties,
    props,
    ...restOptions
  } = options

  // 将 properties 合并到 mpOptions，保持小程序属性定义
  const finalOptions = normalizeProps(restOptions, props, properties)

  // 调用 defineComponent 完成注册
  defineComponent(finalOptions)
}

function normalizeProps(
  baseOptions: Record<string, any>,
  props?: ComponentPropsOptions,
  explicitProperties?: Record<string, any>,
) {
  if (explicitProperties || !props) {
    return {
      ...baseOptions,
      ...(explicitProperties ? { properties: explicitProperties } : {}),
    }
  }

  const properties: Record<string, any> = {}
  Object.entries(props).forEach(([key, definition]) => {
    if (definition === null || definition === undefined) {
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      properties[key] = { type: definition }
      return
    }
    if (typeof definition === 'object') {
      const propOptions: Record<string, any> = {}
      if ('type' in definition && definition.type !== undefined) {
        propOptions.type = (definition as any).type
      }
      const defaultValue = 'default' in definition ? (definition as any).default : (definition as any).value
      if (defaultValue !== undefined) {
        propOptions.value = typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
      }
      properties[key] = propOptions
    }
  })

  return {
    ...baseOptions,
    properties,
  }
}
