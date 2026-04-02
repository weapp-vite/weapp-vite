/**
 * Router 路由类型映射（供声明合并扩展）。
 *
 * 典型用法：在业务项目的类型声明中补充 `entries` 联合类型，
 * 让 `useNativeRouter()/useNativePageRouter()` 的 `url` 参数获得字面量约束。
 */
export interface WevuTypedRouterRouteMap {}

type ResolveTypedRouterEntries = WevuTypedRouterRouteMap extends { entries: infer Entries }
  ? Extract<Entries, string>
  : string
type ResolveTypedRouterTabBarEntries = WevuTypedRouterRouteMap extends { tabBarEntries: infer Entries }
  ? Extract<Entries, string>
  : ResolveTypedRouterEntries

type RelativeRouterUrl = `./${string}` | `../${string}`
type AbsoluteRouterPath<Path extends string>
  = | Path
    | `/${Path}`
type AbsoluteRouterUrl<Path extends string>
  = | AbsoluteRouterPath<Path>
    | `${Path}?${string}`
    | `/${Path}?${string}`

type RouterUrl<Path extends string> = string extends Path ? string : AbsoluteRouterUrl<Path> | RelativeRouterUrl
type RouterPathUrl<Path extends string> = string extends Path ? string : AbsoluteRouterPath<Path>

export type TypedRouterUrl = RouterUrl<ResolveTypedRouterEntries>
export type TypedRouterTabBarUrl = RouterPathUrl<ResolveTypedRouterTabBarEntries>

export type RouterSwitchTabOption = Omit<WechatMiniprogram.SwitchTabOption, 'url'> & {
  url: TypedRouterTabBarUrl
}

export type RouterReLaunchOption = Omit<WechatMiniprogram.ReLaunchOption, 'url'> & {
  url: TypedRouterUrl
}

export type RouterRedirectToOption = Omit<WechatMiniprogram.RedirectToOption, 'url'> & {
  url: TypedRouterUrl
}

export type RouterNavigateToOption = Omit<WechatMiniprogram.NavigateToOption, 'url'> & {
  url: TypedRouterUrl
}

/**
 * setup 场景下推荐使用的 Router 类型。
 * 默认行为与原生 Router 一致；声明合并后可获得更精确的 `url` 类型提示。
 */
export interface SetupContextRouter {
  switchTab: (option: RouterSwitchTabOption) => ReturnType<WechatMiniprogram.Component.Router['switchTab']>
  reLaunch: (option: RouterReLaunchOption) => ReturnType<WechatMiniprogram.Component.Router['reLaunch']>
  redirectTo: (option: RouterRedirectToOption) => ReturnType<WechatMiniprogram.Component.Router['redirectTo']>
  navigateTo: (option: RouterNavigateToOption) => ReturnType<WechatMiniprogram.Component.Router['navigateTo']>
  navigateBack: WechatMiniprogram.Component.Router['navigateBack']
}
