import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  MiniProgramComponentRawOptions,
} from './types'
import { createApp } from './app'
import { applyWevuComponentDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { normalizeProps } from './define/props'
import { createScopedSlotOptions } from './define/scopedSlotOptions'
import { applySetupResult } from './define/setupResult'
import { registerComponent, runSetupFunction } from './register'

let scopedSlotCreator: (() => void) | undefined

function ensureScopedSlotComponentGlobal() {
  const globalObject = typeof globalThis !== 'undefined' ? globalThis : undefined
  if (!globalObject) {
    return
  }
  const globalRecord = globalObject as Record<string, any>
  if (!globalRecord.__weapp_vite_createScopedSlotComponent && scopedSlotCreator) {
    globalRecord.__weapp_vite_createScopedSlotComponent = scopedSlotCreator
  }
}

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
    setData: import('./types').SetDataSnapshotOptions | undefined
    watch: Record<string, any> | undefined
    setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
    mpOptions: MiniProgramComponentRawOptions
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
 *     onMounted(() => console.log('已挂载'))
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * defineComponent({
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
  ensureScopedSlotComponentGlobal()
  const resolvedOptions = applyWevuComponentDefaults(options)
  const {
    data,
    computed,
    methods,
    setData,
    watch,
    setup,
    props,
    ...mpOptions
  } = resolvedOptions

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
    setData,
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
  })

  // 对 setup 的包装：注入 props/context 后应用到 runtime/state/methods
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
    setData,
    watch,
    setup: setupWrapper,
    mpOptions: mpOptionsWithProps,
  }

  registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptionsWithProps)

  // 返回组件定义，便于外部自行注册
  return {
    __wevu_runtime: runtimeApp,
    __wevu_options: componentOptions,
  }
}

/**
 * 从 Vue SFC 选项创建 wevu 组件，供 weapp-vite 编译产物直接调用的兼容入口。
 *
 * @param options 组件选项，可能包含小程序特有的 properties
 */
export function createWevuComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<ComponentPropsOptions, D, C, M> & { properties?: WechatMiniprogram.Component.PropertyOption },
): void {
  ensureScopedSlotComponentGlobal()
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

export function createWevuScopedSlotComponent(
  overrides?: { computed?: ComputedDefinitions },
): void {
  const baseOptions = createScopedSlotOptions(overrides)
  createWevuComponent(baseOptions as any)
}

scopedSlotCreator = createWevuScopedSlotComponent
ensureScopedSlotComponentGlobal()
