import type {
  ComponentPropsOptions,
  ComponentPublicInstance,
  ComputedDefinitions,
  DefineComponentOptions,
  InferProps,
  MethodDefinitions,
  MiniProgramComponentRawOptions,
  ShallowUnwrapRef,
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
    setup: ((props: any, ctx: any) => any) | undefined
    mpOptions: MiniProgramComponentRawOptions
  }
}

type SetupBindings<S> = Exclude<S, void> extends never ? Record<string, never> : Exclude<S, void>
type ResolveProps<P> = P extends ComponentPropsOptions ? InferProps<P> : P
interface WevuComponentConstructor<
  Props,
  RawBindings,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
  new (): ComponentPublicInstance<D, C, M, Props> & ShallowUnwrapRef<RawBindings>
}
interface SetupContextWithTypeProps<TypeProps> {
  props: TypeProps
  [key: string]: any
}
type SetupFunctionWithTypeProps<
  TypeProps,
> = (
  props: TypeProps,
  ctx: SetupContextWithTypeProps<TypeProps>,
) => Record<string, any> | void
interface DefineComponentTypePropsOptions<TypeProps> {
  __typeProps: TypeProps
  setup?: SetupFunctionWithTypeProps<TypeProps>
  [key: string]: any
}
interface DefineComponentWithTypeProps<TypeProps> {
  new (): { $props: TypeProps } & Record<string, any>
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
// @ts-expect-error -- TS2589: overload instantiation depth for __typeProps signature.
export function defineComponent<
  TypeProps = any,
>(
  options: DefineComponentTypePropsOptions<TypeProps>,
): DefineComponentWithTypeProps<TypeProps>
  & ComponentDefinition<Record<string, any>, ComputedDefinitions, MethodDefinitions>
export function defineComponent<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
  S extends Record<string, any> | void = Record<string, any> | void,
>(
  options: DefineComponentOptions<P, D, C, M, S>,
): WevuComponentConstructor<ResolveProps<P>, SetupBindings<S>, D, C, M> & ComponentDefinition<D, C, M>
export function defineComponent(
  options: DefineComponentOptions<any, any, any, any, any>,
): WevuComponentConstructor<Record<string, any>, Record<string, any>, Record<string, any>, ComputedDefinitions, MethodDefinitions>
  & ComponentDefinition<any, any, any> {
  ensureScopedSlotComponentGlobal()
  const resolvedOptions = applyWevuComponentDefaults(options)
  const {
    __typeProps: _typeProps,
    data,
    computed,
    methods,
    setData,
    watch,
    setup,
    props,
    ...mpOptions
  } = resolvedOptions

  const runtimeApp = createApp({
    data,
    computed,
    methods,
    setData,
    [INTERNAL_DEFAULTS_SCOPE_KEY]: 'component',
  } as any)

  // 对 setup 的包装：注入 props/context 后应用到 runtime/state/methods
  const setupWrapper: DefineComponentOptions<ComponentPropsOptions, any, any, any, any>['setup'] = (
    props,
    ctx,
  ) => {
    const result = runSetupFunction(setup as any, props as Record<string, any>, ctx as any) as Record<string, any> | void
    if (result && ctx) {
      applySetupResult((ctx as any).runtime, (ctx as any).instance, result as Record<string, any>)
    }
    return result
  }

  // 保存供手动注册使用的选项
  const mpOptionsWithProps = normalizeProps(mpOptions, props)

  const componentOptions = {
    data: data as () => Record<string, any>,
    computed: computed as ComputedDefinitions,
    methods: methods as MethodDefinitions,
    setData,
    watch,
    setup: setupWrapper,
    mpOptions: mpOptionsWithProps,
  }

  registerComponent(runtimeApp as any, methods ?? {}, watch as any, setupWrapper as any, mpOptionsWithProps as any)

  // 返回组件定义，便于外部自行注册
  const definition: ComponentDefinition<any, any, any> = {
    __wevu_runtime: runtimeApp as any,
    __wevu_options: componentOptions as ComponentDefinition<any, any, any>['__wevu_options'],
  }

  return definition as WevuComponentConstructor<
    Record<string, any>,
    Record<string, any>,
    Record<string, any>,
    ComputedDefinitions,
    MethodDefinitions
  > & ComponentDefinition<any, any, any>
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
