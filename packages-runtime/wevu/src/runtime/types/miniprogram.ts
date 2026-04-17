export interface MiniProgramAdapter {
  setData?: (payload: Record<string, any>) => void | Promise<void>
}

export type MiniProgramComponentBehaviorOptions = WechatMiniprogram.Component.ComponentOptions

type MpComponentOptions = WechatMiniprogram.Component.TrivialOption

export type MiniProgramBehaviorIdentifier = WechatMiniprogram.Behavior.Identifier | string
export type MiniProgramLaunchOptions = WechatMiniprogram.App.LaunchShowOption
export type MiniProgramPageNotFoundOptions = WechatMiniprogram.App.PageNotFoundOption
export type MiniProgramUnhandledRejectionResult = WechatMiniprogram.OnUnhandledRejectionListenerResult
export type MiniProgramThemeChangeResult = WechatMiniprogram.OnThemeChangeListenerResult
export type MiniProgramMemoryWarningResult = WechatMiniprogram.OnMemoryWarningListenerResult
export type MiniProgramPageScrollOption = WechatMiniprogram.Page.IPageScrollOption
export type MiniProgramTabItemTapOption = WechatMiniprogram.Page.ITabItemTapOption
export type MiniProgramPageResizeOption = WechatMiniprogram.Page.IResizeOption
export type MiniProgramShareAppMessageOption = WechatMiniprogram.Page.IShareAppMessageOption
export type MiniProgramAddToFavoritesOption = WechatMiniprogram.Page.IAddToFavoritesOption
export type MiniProgramSaveExitState = WechatMiniprogram.Page.ISaveExitState
export type MiniProgramRouter = WechatMiniprogram.Component.Router
export type MiniProgramPageLifetime = WechatMiniprogram.Page.ILifetime
export type MiniProgramNodesRefFields = Parameters<WechatMiniprogram.NodesRef['fields']>[0]
export type MiniProgramBoundingClientRectResult = WechatMiniprogram.BoundingClientRectCallbackResult
export type MiniProgramScrollOffsetResult = WechatMiniprogram.ScrollOffsetCallbackResult
export type MiniProgramSelectorQuery = WechatMiniprogram.SelectorQuery
export type MiniProgramNodesRef = WechatMiniprogram.NodesRef
export type MiniProgramIntersectionObserverOptions = WechatMiniprogram.CreateIntersectionObserverOption
export type MiniProgramIntersectionObserver = WechatMiniprogram.IntersectionObserver
export type MiniProgramComponentPropertyOption = WechatMiniprogram.Component.PropertyOption
export type MiniProgramComponentMethodOption = WechatMiniprogram.Component.MethodOption
export type MiniProgramComponentEmptyArray = WechatMiniprogram.Component.IEmptyArray
export type MiniProgramComponentAllProperty = WechatMiniprogram.Component.AllProperty
export type MiniProgramComponentAllFullProperty = WechatMiniprogram.Component.AllFullProperty
export type MiniProgramComponentShortProperty = WechatMiniprogram.Component.ShortProperty
export type MiniProgramComponentPropertyValue<TProperty extends MiniProgramComponentAllFullProperty>
  = WechatMiniprogram.Component.PropertyToData<TProperty>
export type MiniProgramComponentInstance<
  D extends object,
  P extends MiniProgramComponentPropertyOption,
  M extends MiniProgramComponentMethodOption,
  B extends MiniProgramComponentEmptyArray = MiniProgramComponentEmptyArray,
> = WechatMiniprogram.Component.Instance<D, P, M, B>

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
  = WechatMiniprogram.App.Options<T>

export type TriggerEventOptions = WechatMiniprogram.Component.TriggerEventOption

export type MiniProgramInstance
  = | WechatMiniprogram.Component.TrivialInstance
    | WechatMiniprogram.Page.TrivialInstance
    | WechatMiniprogram.App.TrivialInstance

export type MiniProgramPageLifetimes = Partial<WechatMiniprogram.Page.ILifetime>

export type MiniProgramComponentRawOptions
  = Omit<WechatMiniprogram.Component.TrivialOption, 'behaviors'>
    & { behaviors?: MiniProgramBehaviorIdentifier[] }
    & MiniProgramPageLifetimes
    & Record<string, any>
