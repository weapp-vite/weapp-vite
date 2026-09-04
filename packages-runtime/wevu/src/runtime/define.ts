import type { WevuBindingManifestV1 } from '@wevu/compiler'
import type { RuntimeComponentDefinitionOptions } from './define/componentDefinition'
import type { InlineExpressionMap } from './register/inline'
import type { TemplateRefBinding } from './templateRefs'
import type {
  ComponentPropsOptions,
  ComponentPublicInstance,
  ComputedDefinitions,
  DefineComponent,
  DefineComponentOptions,
  InferProps,
  MethodDefinitions,
  MiniProgramComponentPropertyOption,
  MiniProgramComponentRawOptions,
  SetDataSnapshotOptions,
  ShallowUnwrapRef,
} from './types'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_CSS_MODULES_KEY,
  WEVU_FUNCTION_PROP_PATHS_KEY,
  WEVU_SCOPED_SLOT_CREATOR_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { hasOwn } from '../utils'
import { hasBindingOutputPath, resolveBindingManifest } from './bindingManifest'
import { applyWevuComponentDefaults } from './defaults'
import {
  createRuntimeComponentDefinition,
} from './define/componentDefinition'
import { resolveNativeInitialData } from './define/initialComputed'
import { resolveVueComponentOptions } from './define/options'
import { applyOptionsApiProvide, resolveOptionsApiInjections } from './define/optionsApi'
import { normalizeProps } from './define/props'
import { createScopedSlotOptions } from './define/scopedSlotOptions'
import { applySetupResult } from './define/setupResult'
import { getScopedSlotHostGlobalObject } from './platform'
import { runSetupFunction } from './register'
import { allocateOwnerId } from './scopedSlots'

let scopedSlotCreator: (() => void) | undefined
const componentLifecycleDefinitions = new WeakMap<object, Record<string, any>>()

function ensureScopedSlotComponentGlobal() {
  const globalObject = getScopedSlotHostGlobalObject()
  if (!globalObject) {
    return
  }
  const globalRecord = globalObject as Record<string, any>
  if (scopedSlotCreator && globalRecord[WEVU_SCOPED_SLOT_CREATOR_KEY] !== scopedSlotCreator) {
    globalRecord[WEVU_SCOPED_SLOT_CREATOR_KEY] = scopedSlotCreator
  }
}

function resolveInitialDataContext(properties: unknown, methods: MethodDefinitions | undefined) {
  const context: Record<string, unknown> = { ...(methods ?? {}) }
  if (!properties || typeof properties !== 'object') {
    return context
  }
  for (const [name, definition] of Object.entries(properties)) {
    if (definition && typeof definition === 'object' && hasOwn(definition, 'value')) {
      context[name] = (definition as Record<string, unknown>).value
    }
  }
  return context
}

function shouldDeclareNativeSlotOwnerId(
  setData: SetDataSnapshotOptions | undefined,
  bindingManifest: WevuBindingManifestV1 | undefined,
) {
  return (
    Array.isArray(setData?.pick)
    && setData.pick.includes(WEVU_SLOT_OWNER_ID_KEY)
  ) || (
    bindingManifest?.features.scopedSlots === true
    && hasBindingOutputPath(bindingManifest, WEVU_SLOT_OWNER_ID_KEY)
  )
}

function shouldSeedNativeSlotOwnerId(mpOptions: Record<string, unknown>) {
  return Boolean(mpOptions.__wevu_isPage)
}

function hasScopedSlotHostProperties(mpOptions: Record<string, any>) {
  const properties = mpOptions.properties
  return Boolean(
    properties
    && typeof properties === 'object'
    && (
      WEVU_SLOT_OWNER_ID_PROP in properties
      || WEVU_SLOT_SCOPE_KEY in properties
    ),
  )
}

function resolveScopedSlotHostSetData(
  mpOptions: Record<string, any>,
  setData: DefineComponentOptions<any, any, any, any, any>['setData'],
) {
  if (setData?.strategy !== 'patch' || !hasScopedSlotHostProperties(mpOptions)) {
    return setData
  }
  return {
    ...setData,
    strategy: 'diff' as const,
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
    bindingManifest?: WevuBindingManifestV1
    watch: Record<string, any> | undefined
    setup: ((props: any, ctx: any) => any) | undefined
    mpOptions: MiniProgramComponentRawOptions
  }
}

function materializeComponentDefinition(
  componentOptions: RuntimeComponentDefinitionOptions,
  registerNative = false,
) {
  const { lifecycleDefinition, runtimeApp } = createRuntimeComponentDefinition(componentOptions, registerNative)
  const definition: ComponentDefinition<any, any, any> = {
    __wevu_runtime: runtimeApp as any,
    __wevu_options: componentOptions as ComponentDefinition<any, any, any>['__wevu_options'],
  }
  componentLifecycleDefinitions.set(definition, lifecycleDefinition)
  return definition
}

type SetupBindings<S> = Exclude<S, void> extends never ? Record<string, never> : Exclude<S, void>
type ResolveProps<P> = P extends ComponentPropsOptions ? InferProps<P> : P

export interface WevuComponentConstructor<
  Props,
  RawBindings,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
  new (): ComponentPublicInstance<D, C, M, Props> & ShallowUnwrapRef<RawBindings>
}

export type WevuDefinedComponent<
  PropsOrPropOptions,
  RawBindings,
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponent<PropsOrPropOptions, RawBindings, D, C, M> & ComponentDefinition<D, C, M>
export interface SetupContextWithTypeProps<TypeProps> {
  props: TypeProps
  [key: string]: any
}
export type SetupFunctionWithTypeProps<
  TypeProps,
> = (
  props: TypeProps,
  ctx: SetupContextWithTypeProps<TypeProps>,
) => Record<string, any> | void
export interface DefineComponentTypePropsOptions<TypeProps> {
  __typeProps: TypeProps
  setup?: SetupFunctionWithTypeProps<TypeProps>
  [key: string]: any
}
export interface DefineComponentWithTypeProps<TypeProps> {
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
// @ts-expect-error -- TS2589：__typeProps 签名的重载实例化深度过高。
export function defineComponent<
  TypeProps = any,
>(
  options: DefineComponentTypePropsOptions<TypeProps>,
): DefineComponentWithTypeProps<TypeProps>
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
  // eslint-disable-next-line ts/no-use-before-define -- 重载实现需保持在内部共享工厂之前。
  return createComponentDefinition(options, true) as any
}

function createComponentDefinition(
  options: DefineComponentOptions<any, any, any, any, any>,
  registerNative: boolean,
) {
  if (registerNative) {
    ensureScopedSlotComponentGlobal()
  }
  const resolvedOptions = resolveVueComponentOptions(applyWevuComponentDefaults(options))
  const {
    __typeProps: _typeProps,
    data,
    computed,
    methods,
    setData,
    watch,
    setup,
    props,
    inject: injectOptions,
    provide: provideOptions,
    allowFunctionProps,
    [WEVU_BINDING_MANIFEST_KEY]: rawBindingManifest,
    [WEVU_CSS_MODULES_KEY]: cssModules,
    ...mpOptions
  } = resolvedOptions
  const bindingManifest = resolveBindingManifest(rawBindingManifest)

  const rawFunctionPropPaths = (mpOptions as any)[WEVU_FUNCTION_PROP_PATHS_KEY]
  const functionPropPaths: string[] = Array.isArray(rawFunctionPropPaths)
    ? [...new Set(rawFunctionPropPaths.filter((path: unknown): path is string => typeof path === 'string' && path.length > 0))]
    : []
  delete (mpOptions as any)[WEVU_FUNCTION_PROP_PATHS_KEY]

  const rawResolvedSetData = allowFunctionProps === true
    ? {
        ...(setData ?? {}),
        includeFunctions: true,
        functionPaths: functionPropPaths,
      }
    : allowFunctionProps === false
      ? setData
      : functionPropPaths.length
        ? {
            ...(setData ?? {}),
            functionPaths: functionPropPaths,
          }
        : setData
  const resolvedSetData = resolveScopedSlotHostSetData(mpOptions, rawResolvedSetData)
  const setupFunctionPropKeys = new Set(
    functionPropPaths
      .filter(path => !path.includes('.')),
  )

  const normalizedMpOptions = normalizeProps(mpOptions, props)
  const initialDataContext = resolveInitialDataContext(normalizedMpOptions.properties, methods)
  const resolvedData = typeof data === 'function'
    ? () => data.call(initialDataContext)
    : data

  const hasOptionsApiContext = injectOptions != null || provideOptions != null
  const setupWrapper = typeof setup === 'function' || hasOptionsApiContext || cssModules
    ? ((props, ctx) => {
      if (cssModules && typeof cssModules === 'object') {
        ;((ctx as any).instance as Record<string, any>)[WEVU_CSS_MODULES_KEY] = cssModules
      }
      const publicInstance = (ctx as any)?.proxy ?? (ctx as any)?.instance ?? Object.create(null)
      const injected = resolveOptionsApiInjections(injectOptions, publicInstance)
      if (provideOptions != null) {
        applyOptionsApiProvide(provideOptions, publicInstance)
      }
      const setupResult = typeof setup === 'function'
        ? runSetupFunction(setup as any, props as Record<string, any>, ctx as any) as Record<string, any> | void
        : undefined
      const result = {
        ...injected,
        ...(cssModules ?? {}),
        ...(setupResult ?? {}),
      }
      if (ctx && Object.keys(result).length) {
        applySetupResult((ctx as any).runtime, (ctx as any).instance, result, {
          includeFunctionsInState: allowFunctionProps === true,
          functionPropPaths: allowFunctionProps === false ? undefined : setupFunctionPropKeys,
        })
      }
      return result
    }) satisfies DefineComponentOptions<ComponentPropsOptions, any, any, any, any>['setup']
    : undefined

  const nativeData = typeof resolvedData === 'function'
    ? resolvedData()
    : resolvedData
  const shouldDeclareOwnerId = shouldDeclareNativeSlotOwnerId(resolvedSetData, bindingManifest)
  const seededNativeData = shouldDeclareOwnerId
    ? {
        ...(nativeData && typeof nativeData === 'object' ? nativeData : {}),
        [WEVU_SLOT_OWNER_ID_KEY]: shouldSeedNativeSlotOwnerId(mpOptions)
          ? (nativeData as any)?.[WEVU_SLOT_OWNER_ID_KEY] || allocateOwnerId()
          : (nativeData as any)?.[WEVU_SLOT_OWNER_ID_KEY] || '',
      }
    : nativeData
  const nativeInitialData = resolveNativeInitialData(seededNativeData, computed as ComputedDefinitions, resolvedSetData, methods as Record<string, any> | undefined)
  const mpOptionsWithProps = nativeInitialData !== undefined
    ? {
        ...normalizedMpOptions,
        data: nativeInitialData,
      }
    : normalizedMpOptions

  const componentOptions: RuntimeComponentDefinitionOptions = {
    data: resolvedData as () => Record<string, any>,
    computed: computed as ComputedDefinitions,
    methods: methods as MethodDefinitions,
    setData: resolvedSetData,
    bindingManifest,
    watch,
    setup: setupWrapper,
    mpOptions: mpOptionsWithProps as MiniProgramComponentRawOptions,
  }

  const definition = materializeComponentDefinition(componentOptions, registerNative)

  return definition as unknown as WevuComponentConstructor<
    ResolveProps<ComponentPropsOptions>,
    Record<string, any>,
    Record<string, any>,
    ComputedDefinitions,
    MethodDefinitions
  > & ComponentDefinition<any, any, any>
}

/**
 * 创建不触发宿主全局注册的 Wevu 组件定义。
 *
 * @param options 组件选项
 * @internal
 */
export function createWevuComponentDefinition(
  options: DefineComponentOptions<any, any, any, any, any>,
) {
  return createComponentDefinition(options, false)
}

/**
 * 从现有组件定义派生拥有独立应用上下文的组件定义。
 *
 * @param definition 已解析的 Wevu 组件定义
 * @internal
 */
export function createIsolatedWevuComponentDefinition(definition: object) {
  const componentOptions = (definition as ComponentDefinition<any, any, any>).__wevu_options
  if (!componentOptions) {
    throw new TypeError('无法从非 Wevu 组件定义创建独立运行时')
  }
  return materializeComponentDefinition(componentOptions)
}

/**
 * 获取组件定义对应的宿主生命周期定义。
 *
 * @param definition Wevu 组件定义
 * @internal
 */
export function getWevuComponentLifecycleDefinition(definition: object) {
  return componentLifecycleDefinitions.get(definition)
}

/**
 * 从 Vue SFC 选项创建 wevu 组件，供 weapp-vite 编译产物直接调用的兼容入口。
 *
 * @param options 组件选项，可能包含小程序特有的 properties
 * @internal
 */
export function createWevuComponent<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(
  options: DefineComponentOptions<P, D, C, M> & { properties?: MiniProgramComponentPropertyOption },
): void {
  ensureScopedSlotComponentGlobal()
  const {
    properties,
    props,
    ...restOptions
  } = options

  const baseOptions = {
    ...restOptions,
    allowNullPropInput: (restOptions as any).allowNullPropInput ?? true,
    __wevu_allowNullPropInput: true,
  }

  // 将 properties 合并到 mpOptions，保持小程序属性定义
  const finalOptions = normalizeProps(baseOptions, props, properties)

  defineComponent(finalOptions)
}

/**
 * scoped slot 兼容组件入口（编译产物内部使用）。
 * @internal
 */
export function createWevuScopedSlotComponent(
  overrides?: {
    computed?: ComputedDefinitions
    inlineMap?: InlineExpressionMap
    templateRefs?: TemplateRefBinding[]
    [WEVU_BINDING_MANIFEST_KEY]?: WevuBindingManifestV1
  },
): void {
  const baseOptions = createScopedSlotOptions(overrides)
  createWevuComponent(baseOptions as any)
}

scopedSlotCreator = createWevuScopedSlotComponent
ensureScopedSlotComponentGlobal()
