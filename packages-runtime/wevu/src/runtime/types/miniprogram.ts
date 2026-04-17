import type {
  NativeMiniProgramAppOptions,
  NativeMiniProgramAppTrivialInstance,
  NativeMiniProgramBehaviorIdentifier,
  NativeMiniProgramComponentAllFullProperty,
  NativeMiniProgramComponentEmptyArray,
  NativeMiniProgramComponentInstance,
  NativeMiniProgramComponentMethodOption,
  NativeMiniProgramComponentPropertyOption,
  NativeMiniProgramComponentPropertyValue,
  NativeMiniProgramComponentTrivialInstance,
  NativeMiniProgramComponentTrivialOption,
  NativeMiniProgramPageLifetime,
  NativeMiniProgramPageTrivialInstance,
} from './miniprogramNative'

export type {
  NativeMiniProgramAddToFavoritesOption as MiniProgramAddToFavoritesOption,
  NativeMiniProgramBoundingClientRectResult as MiniProgramBoundingClientRectResult,
  NativeMiniProgramComponentAllFullProperty as MiniProgramComponentAllFullProperty,
  NativeMiniProgramComponentAllProperty as MiniProgramComponentAllProperty,
  NativeMiniProgramComponentBehaviorOptions as MiniProgramComponentBehaviorOptions,
  NativeMiniProgramComponentEmptyArray as MiniProgramComponentEmptyArray,
  NativeMiniProgramComponentMethodOption as MiniProgramComponentMethodOption,
  NativeMiniProgramComponentPropertyOption as MiniProgramComponentPropertyOption,
  NativeMiniProgramComponentShortProperty as MiniProgramComponentShortProperty,
  NativeMiniProgramIntersectionObserver as MiniProgramIntersectionObserver,
  NativeMiniProgramIntersectionObserverOptions as MiniProgramIntersectionObserverOptions,
  NativeMiniProgramLaunchOptions as MiniProgramLaunchOptions,
  NativeMiniProgramMemoryWarningResult as MiniProgramMemoryWarningResult,
  NativeMiniProgramNavigateToOption as MiniProgramNavigateToOption,
  NativeMiniProgramNodesRef as MiniProgramNodesRef,
  NativeMiniProgramNodesRefFields as MiniProgramNodesRefFields,
  NativeMiniProgramPageLifetime as MiniProgramPageLifetime,
  NativeMiniProgramPageNotFoundOptions as MiniProgramPageNotFoundOptions,
  NativeMiniProgramPageResizeOption as MiniProgramPageResizeOption,
  NativeMiniProgramPageScrollOption as MiniProgramPageScrollOption,
  NativeMiniProgramRedirectToOption as MiniProgramRedirectToOption,
  NativeMiniProgramReLaunchOption as MiniProgramReLaunchOption,
  NativeMiniProgramRouter as MiniProgramRouter,
  NativeMiniProgramSaveExitState as MiniProgramSaveExitState,
  NativeMiniProgramScrollOffsetResult as MiniProgramScrollOffsetResult,
  NativeMiniProgramSelectorQuery as MiniProgramSelectorQuery,
  NativeMiniProgramShareAppMessageOption as MiniProgramShareAppMessageOption,
  NativeMiniProgramSwitchTabOption as MiniProgramSwitchTabOption,
  NativeMiniProgramTabItemTapOption as MiniProgramTabItemTapOption,
  NativeMiniProgramThemeChangeResult as MiniProgramThemeChangeResult,
  NativeMiniProgramUnhandledRejectionResult as MiniProgramUnhandledRejectionResult,
  NativeMiniProgramTriggerEventOptions as TriggerEventOptions,
} from './miniprogramNative'

export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

type MpComponentOptions = NativeMiniProgramComponentTrivialOption

export type MiniProgramBehaviorIdentifier = NativeMiniProgramBehaviorIdentifier | string
export type MiniProgramComponentPropertyValue<TProperty extends NativeMiniProgramComponentAllFullProperty>
  = NativeMiniProgramComponentPropertyValue<TProperty>
export type MiniProgramComponentInstance<
  D extends object,
  P extends NativeMiniProgramComponentPropertyOption,
  M extends NativeMiniProgramComponentMethodOption,
  B extends NativeMiniProgramComponentEmptyArray = NativeMiniProgramComponentEmptyArray,
> = NativeMiniProgramComponentInstance<D, P, M, B>

export interface MiniProgramComponentOptions {
  /**
   * 类似于 mixins/traits 的组件间代码复用机制（behaviors）。
   */
  behaviors?: MiniProgramBehaviorIdentifier[]

  /**
   * 组件接受的外部样式类。
   */
  externalClasses?: MpComponentOptions['externalClasses']

  /**
   * 组件间关系定义。
   */
  relations?: MpComponentOptions['relations']

  /**
   * 组件数据字段监听器，用于监听 properties 和 data 的变化。
   */
  observers?: MpComponentOptions['observers']

  /**
   * 组件生命周期声明对象：
   * `created`/`attached`/`ready`/`moved`/`detached`/`error`。
   *
   * 注意：wevu 会在 `attached/ready/detached/moved/error` 阶段做桥接与包装。
   * setup 默认在 `attached` 执行，可通过 `setupLifecycle = "created"` 切换回旧行为。
   */
  lifetimes?: MpComponentOptions['lifetimes']

  /**
   * 组件所在页面的生命周期声明对象：`show`/`hide`/`resize`/`routeDone`。
   */
  pageLifetimes?: MpComponentOptions['pageLifetimes']

  /**
   * 组件选项（multipleSlots/styleIsolation/pureDataPattern/virtualHost 等）。
   */
  options?: MpComponentOptions['options']

  /**
   * 定义段过滤器，用于自定义组件扩展。
   */
  definitionFilter?: MpComponentOptions['definitionFilter']

  /**
   * 组件自定义导出：当使用组件导出 behavior（例如微信中的 `wx://component-export`）时，
   * 可用于指定组件被 selectComponent 调用时的返回值。
   *
   * wevu 默认会将 setup() 中通过 `expose()` 写入的内容作为 export() 返回值，
   * 因此大多数情况下无需手动编写 export()；若同时提供 export()，则会与 expose() 结果浅合并。
   */
  export?: MpComponentOptions['export']

  /**
   * 原生 properties（与 wevu 的 props 不同）。
   *
   * - 推荐：使用 wevu 的 `props` 选项，让运行时规范化为小程序 `properties`。
   * - 兼容：也可以直接传入小程序 `properties`。
   */
  properties?: MpComponentOptions['properties']

  /**
   * 旧式生命周期（基础库 `2.2.3` 起推荐使用 `lifetimes` 字段）。
   * 保留以增强类型提示与兼容性。
   */
  created?: MpComponentOptions['created']
  attached?: MpComponentOptions['attached']
  ready?: MpComponentOptions['ready']
  moved?: MpComponentOptions['moved']
  detached?: MpComponentOptions['detached']
  error?: MpComponentOptions['error']
}

export type MiniProgramAppOptions<T extends Record<string, any> = Record<string, any>>
  = NativeMiniProgramAppOptions<T>

export type MiniProgramInstance
  = | NativeMiniProgramComponentTrivialInstance
    | NativeMiniProgramPageTrivialInstance
    | NativeMiniProgramAppTrivialInstance

export type MiniProgramPageLifetimes = Partial<NativeMiniProgramPageLifetime>

export type MiniProgramComponentRawOptions
  = Omit<NativeMiniProgramComponentTrivialOption, 'behaviors'>
    & { behaviors?: MiniProgramBehaviorIdentifier[] }
    & MiniProgramPageLifetimes
    & Record<string, any>
