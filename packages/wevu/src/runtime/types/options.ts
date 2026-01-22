import type { ComputedDefinitions, MethodDefinitions } from './core'
import type { MiniProgramAppOptions, MiniProgramComponentOptions, MiniProgramPageLifetimes } from './miniprogram'
import type { ComponentPropsOptions, SetupContext, SetupFunction } from './props'
import type { SetDataSnapshotOptions } from './setData'

export interface DefineComponentOptions<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
  S extends Record<string, any> | void = Record<string, any> | void,
> extends MiniProgramComponentOptions, MiniProgramPageLifetimes {
  /**
   * 页面特性开关（用于按需注入 Page 事件处理函数）。
   *
   * 说明：小程序的部分页面事件/菜单项具有“按需派发/按需展示”特性，
   * 只有定义了对应的 `onXXX` 方法才会触发/展示（如 `onPageScroll`、`onShareTimeline`）。
   * 因此 wevu 需要在注册阶段（Component()）就决定是否注入这些 onXXX。
   *
   * - 若你在 options 中显式定义了原生 `onXXX`，wevu 会自动桥接对应 hook（无需 features）。
   * - 若你只想在 `setup()` 里使用 wevu hook（不额外写原生 `onXXX`），则通过 `features` 显式开启注入。
   */
  features?: PageFeatures

  /**
   * 类 Vue 的 props 定义（会被规范化为小程序 `properties`）
   */
  props?: P
  watch?: Record<string, any>
  setup?: SetupFunction<P, D, C, M, S>

  /**
   * 组件 data（建议使用函数返回初始值）。
   */
  data?: () => D

  /**
   * 组件 computed（会参与快照 diff）。
   */
  computed?: C

  /**
   * setData 快照控制选项（用于优化性能与 payload）。
   */
  setData?: SetDataSnapshotOptions

  /**
   * 组件 methods（会绑定到 public instance 上）。
   */
  methods?: M

  /**
   * 透传/扩展字段：允许携带其他小程序原生 Component 选项或自定义字段。
   * 说明：为保持兼容性保留索引签名，但仍会对已知字段提供智能提示。
   */
  [key: string]: any
}

export interface DefineAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends MiniProgramAppOptions {
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface CreateAppOptions<
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
> extends MiniProgramAppOptions {
  data?: () => D
  computed?: C
  methods?: M
  setData?: SetDataSnapshotOptions
  watch?: Record<string, any>
  setup?: (ctx: SetupContext<D, C, M>) => Record<string, any> | void
  [key: string]: any
}

export interface PageFeatures {
  /**
   * 启用页面滚动事件（注入 `onPageScroll`）。
   */
  enableOnPageScroll?: boolean
  /**
   * 启用下拉刷新事件（注入 `onPullDownRefresh`；仍需在页面配置开启 enablePullDownRefresh）。
   */
  enableOnPullDownRefresh?: boolean
  /**
   * 启用触底事件（注入 `onReachBottom`）。
   */
  enableOnReachBottom?: boolean
  /**
   * 启用路由动画完成事件（注入 `onRouteDone`）。
   */
  enableOnRouteDone?: boolean
  /**
   * 启用 Tab 点击事件（注入 `onTabItemTap`）。
   */
  enableOnTabItemTap?: boolean
  /**
   * 启用窗口尺寸变化事件（注入 `onResize`）。
   */
  enableOnResize?: boolean

  /**
   * 启用“转发/分享给朋友”（注入 `onShareAppMessage`，使右上角菜单显示“转发”）。
   */
  enableOnShareAppMessage?: boolean
  /**
   * 启用“分享到朋友圈”（注入 `onShareTimeline`，使右上角菜单显示“分享到朋友圈”）。
   */
  enableOnShareTimeline?: boolean
  /**
   * 启用“收藏”（注入 `onAddToFavorites`）。
   */
  enableOnAddToFavorites?: boolean
  /**
   * 启用“退出状态保存”（注入 `onSaveExitState`）。
   */
  enableOnSaveExitState?: boolean
}
