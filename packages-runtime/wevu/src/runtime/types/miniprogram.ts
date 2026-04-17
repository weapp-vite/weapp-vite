import type {
  HostMiniProgramAppOptions,
  HostMiniProgramAppTrivialInstance,
  HostMiniProgramBehaviorIdentifier,
  HostMiniProgramComponentAllFullProperty,
  HostMiniProgramComponentEmptyArray,
  HostMiniProgramComponentInstance,
  HostMiniProgramComponentMethodOption,
  HostMiniProgramComponentPropertyOption,
  HostMiniProgramComponentPropertyValue,
  HostMiniProgramComponentTrivialInstance,
  HostMiniProgramComponentTrivialOption,
  HostMiniProgramPageLifetime,
  HostMiniProgramPageTrivialInstance,
} from './miniprogramHost'

export type {
  HostMiniProgramAddToFavoritesOption as MiniProgramAddToFavoritesOption,
  HostMiniProgramBoundingClientRectResult as MiniProgramBoundingClientRectResult,
  HostMiniProgramComponentAllFullProperty as MiniProgramComponentAllFullProperty,
  HostMiniProgramComponentAllProperty as MiniProgramComponentAllProperty,
  HostMiniProgramComponentBehaviorOptions as MiniProgramComponentBehaviorOptions,
  HostMiniProgramComponentEmptyArray as MiniProgramComponentEmptyArray,
  HostMiniProgramComponentMethodOption as MiniProgramComponentMethodOption,
  HostMiniProgramComponentPropertyOption as MiniProgramComponentPropertyOption,
  HostMiniProgramComponentShortProperty as MiniProgramComponentShortProperty,
  HostMiniProgramIntersectionObserver as MiniProgramIntersectionObserver,
  HostMiniProgramIntersectionObserverOptions as MiniProgramIntersectionObserverOptions,
  HostMiniProgramLaunchOptions as MiniProgramLaunchOptions,
  HostMiniProgramMemoryWarningResult as MiniProgramMemoryWarningResult,
  HostMiniProgramNavigateToOption as MiniProgramNavigateToOption,
  HostMiniProgramNodesRef as MiniProgramNodesRef,
  HostMiniProgramNodesRefFields as MiniProgramNodesRefFields,
  HostMiniProgramPageLifetime as MiniProgramPageLifetime,
  HostMiniProgramPageNotFoundOptions as MiniProgramPageNotFoundOptions,
  HostMiniProgramPageResizeOption as MiniProgramPageResizeOption,
  HostMiniProgramPageScrollOption as MiniProgramPageScrollOption,
  HostMiniProgramRedirectToOption as MiniProgramRedirectToOption,
  HostMiniProgramReLaunchOption as MiniProgramReLaunchOption,
  HostMiniProgramRouter as MiniProgramRouter,
  HostMiniProgramSaveExitState as MiniProgramSaveExitState,
  HostMiniProgramScrollOffsetResult as MiniProgramScrollOffsetResult,
  HostMiniProgramSelectorQuery as MiniProgramSelectorQuery,
  HostMiniProgramShareAppMessageOption as MiniProgramShareAppMessageOption,
  HostMiniProgramSwitchTabOption as MiniProgramSwitchTabOption,
  HostMiniProgramTabItemTapOption as MiniProgramTabItemTapOption,
  HostMiniProgramThemeChangeResult as MiniProgramThemeChangeResult,
  HostMiniProgramUnhandledRejectionResult as MiniProgramUnhandledRejectionResult,
  HostMiniProgramTriggerEventOptions as TriggerEventOptions,
} from './miniprogramHost'

export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

type MpComponentOptions = HostMiniProgramComponentTrivialOption

export type MiniProgramBehaviorIdentifier = HostMiniProgramBehaviorIdentifier | string
export type MiniProgramComponentPropertyValue<TProperty extends HostMiniProgramComponentAllFullProperty>
  = HostMiniProgramComponentPropertyValue<TProperty>
export type MiniProgramComponentInstance<
  D extends object,
  P extends HostMiniProgramComponentPropertyOption,
  M extends HostMiniProgramComponentMethodOption,
  B extends HostMiniProgramComponentEmptyArray = HostMiniProgramComponentEmptyArray,
> = HostMiniProgramComponentInstance<D, P, M, B>

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
  = HostMiniProgramAppOptions<T>

export type MiniProgramInstance
  = | HostMiniProgramComponentTrivialInstance
    | HostMiniProgramPageTrivialInstance
    | HostMiniProgramAppTrivialInstance

export type MiniProgramPageLifetimes = Partial<HostMiniProgramPageLifetime>

export type MiniProgramComponentRawOptions
  = Omit<HostMiniProgramComponentTrivialOption, 'behaviors'>
    & { behaviors?: MiniProgramBehaviorIdentifier[] }
    & MiniProgramPageLifetimes
    & Record<string, any>
