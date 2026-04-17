export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

type NativeMiniProgramComponentBehaviorOptions = WechatMiniprogram.Component.ComponentOptions
type NativeMiniProgramComponentTrivialOption = WechatMiniprogram.Component.TrivialOption
type NativeMiniProgramBehaviorIdentifier = WechatMiniprogram.Behavior.Identifier
type NativeMiniProgramLaunchOptions = WechatMiniprogram.App.LaunchShowOption
type NativeMiniProgramPageNotFoundOptions = WechatMiniprogram.App.PageNotFoundOption
type NativeMiniProgramUnhandledRejectionResult = WechatMiniprogram.OnUnhandledRejectionListenerResult
type NativeMiniProgramThemeChangeResult = WechatMiniprogram.OnThemeChangeListenerResult
type NativeMiniProgramMemoryWarningResult = WechatMiniprogram.OnMemoryWarningListenerResult
type NativeMiniProgramPageScrollOption = WechatMiniprogram.Page.IPageScrollOption
type NativeMiniProgramTabItemTapOption = WechatMiniprogram.Page.ITabItemTapOption
type NativeMiniProgramPageResizeOption = WechatMiniprogram.Page.IResizeOption
type NativeMiniProgramShareAppMessageOption = WechatMiniprogram.Page.IShareAppMessageOption
type NativeMiniProgramAddToFavoritesOption = WechatMiniprogram.Page.IAddToFavoritesOption
type NativeMiniProgramSaveExitState = WechatMiniprogram.Page.ISaveExitState
type NativeMiniProgramRouter = WechatMiniprogram.Component.Router
type NativeMiniProgramSwitchTabOption = WechatMiniprogram.SwitchTabOption
type NativeMiniProgramReLaunchOption = WechatMiniprogram.ReLaunchOption
type NativeMiniProgramRedirectToOption = WechatMiniprogram.RedirectToOption
type NativeMiniProgramNavigateToOption = WechatMiniprogram.NavigateToOption
type NativeMiniProgramPageLifetime = WechatMiniprogram.Page.ILifetime
type NativeMiniProgramNodesRef = WechatMiniprogram.NodesRef
type NativeMiniProgramNodesRefFields = Parameters<NativeMiniProgramNodesRef['fields']>[0]
type NativeMiniProgramBoundingClientRectResult = WechatMiniprogram.BoundingClientRectCallbackResult
type NativeMiniProgramScrollOffsetResult = WechatMiniprogram.ScrollOffsetCallbackResult
type NativeMiniProgramSelectorQuery = WechatMiniprogram.SelectorQuery
type NativeMiniProgramIntersectionObserverOptions = WechatMiniprogram.CreateIntersectionObserverOption
type NativeMiniProgramIntersectionObserver = WechatMiniprogram.IntersectionObserver
type NativeMiniProgramComponentPropertyOption = WechatMiniprogram.Component.PropertyOption
type NativeMiniProgramComponentMethodOption = WechatMiniprogram.Component.MethodOption
type NativeMiniProgramComponentEmptyArray = WechatMiniprogram.Component.IEmptyArray
type NativeMiniProgramComponentAllProperty = WechatMiniprogram.Component.AllProperty
type NativeMiniProgramComponentAllFullProperty = WechatMiniprogram.Component.AllFullProperty
type NativeMiniProgramComponentShortProperty = WechatMiniprogram.Component.ShortProperty
type NativeMiniProgramComponentPropertyValue<TProperty extends NativeMiniProgramComponentAllFullProperty>
  = WechatMiniprogram.Component.PropertyToData<TProperty>
type NativeMiniProgramComponentInstance<
  D extends object,
  P extends NativeMiniProgramComponentPropertyOption,
  M extends NativeMiniProgramComponentMethodOption,
  B extends NativeMiniProgramComponentEmptyArray = NativeMiniProgramComponentEmptyArray,
> = WechatMiniprogram.Component.Instance<D, P, M, B>
type NativeMiniProgramTriggerEventOptions = WechatMiniprogram.Component.TriggerEventOption
type NativeMiniProgramAppOptions<T extends Record<string, any>> = WechatMiniprogram.App.Options<T>
type NativeMiniProgramComponentTrivialInstance = WechatMiniprogram.Component.TrivialInstance
type NativeMiniProgramPageTrivialInstance = WechatMiniprogram.Page.TrivialInstance
type NativeMiniProgramAppTrivialInstance = WechatMiniprogram.App.TrivialInstance

export type MiniProgramComponentBehaviorOptions = NativeMiniProgramComponentBehaviorOptions

type MpComponentOptions = NativeMiniProgramComponentTrivialOption

export type MiniProgramBehaviorIdentifier = NativeMiniProgramBehaviorIdentifier | string
export type MiniProgramLaunchOptions = NativeMiniProgramLaunchOptions
export type MiniProgramPageNotFoundOptions = NativeMiniProgramPageNotFoundOptions
export type MiniProgramUnhandledRejectionResult = NativeMiniProgramUnhandledRejectionResult
export type MiniProgramThemeChangeResult = NativeMiniProgramThemeChangeResult
export type MiniProgramMemoryWarningResult = NativeMiniProgramMemoryWarningResult
export type MiniProgramPageScrollOption = NativeMiniProgramPageScrollOption
export type MiniProgramTabItemTapOption = NativeMiniProgramTabItemTapOption
export type MiniProgramPageResizeOption = NativeMiniProgramPageResizeOption
export type MiniProgramShareAppMessageOption = NativeMiniProgramShareAppMessageOption
export type MiniProgramAddToFavoritesOption = NativeMiniProgramAddToFavoritesOption
export type MiniProgramSaveExitState = NativeMiniProgramSaveExitState
export type MiniProgramRouter = NativeMiniProgramRouter
export type MiniProgramSwitchTabOption = NativeMiniProgramSwitchTabOption
export type MiniProgramReLaunchOption = NativeMiniProgramReLaunchOption
export type MiniProgramRedirectToOption = NativeMiniProgramRedirectToOption
export type MiniProgramNavigateToOption = NativeMiniProgramNavigateToOption
export type MiniProgramPageLifetime = NativeMiniProgramPageLifetime
export type MiniProgramNodesRefFields = NativeMiniProgramNodesRefFields
export type MiniProgramBoundingClientRectResult = NativeMiniProgramBoundingClientRectResult
export type MiniProgramScrollOffsetResult = NativeMiniProgramScrollOffsetResult
export type MiniProgramSelectorQuery = NativeMiniProgramSelectorQuery
export type MiniProgramNodesRef = NativeMiniProgramNodesRef
export type MiniProgramIntersectionObserverOptions = NativeMiniProgramIntersectionObserverOptions
export type MiniProgramIntersectionObserver = NativeMiniProgramIntersectionObserver
export type MiniProgramComponentPropertyOption = NativeMiniProgramComponentPropertyOption
export type MiniProgramComponentMethodOption = NativeMiniProgramComponentMethodOption
export type MiniProgramComponentEmptyArray = NativeMiniProgramComponentEmptyArray
export type MiniProgramComponentAllProperty = NativeMiniProgramComponentAllProperty
export type MiniProgramComponentAllFullProperty = NativeMiniProgramComponentAllFullProperty
export type MiniProgramComponentShortProperty = NativeMiniProgramComponentShortProperty
export type MiniProgramComponentPropertyValue<TProperty extends MiniProgramComponentAllFullProperty>
  = NativeMiniProgramComponentPropertyValue<TProperty>
export type MiniProgramComponentInstance<
  D extends object,
  P extends MiniProgramComponentPropertyOption,
  M extends MiniProgramComponentMethodOption,
  B extends MiniProgramComponentEmptyArray = MiniProgramComponentEmptyArray,
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

export type TriggerEventOptions = NativeMiniProgramTriggerEventOptions

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
