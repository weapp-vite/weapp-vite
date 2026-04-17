import type { MiniProgramRouter } from '../miniprogram'

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

export type MiniProgramRouterSwitchTabOption = Omit<WechatMiniprogram.SwitchTabOption, 'url'> & {
  url: TypedRouterTabBarUrl
}
export type RouterSwitchTabOption = MiniProgramRouterSwitchTabOption

export type MiniProgramRouterReLaunchOption = Omit<WechatMiniprogram.ReLaunchOption, 'url'> & {
  url: TypedRouterUrl
}
export type RouterReLaunchOption = MiniProgramRouterReLaunchOption

export type MiniProgramRouterRedirectToOption = Omit<WechatMiniprogram.RedirectToOption, 'url'> & {
  url: TypedRouterUrl
}
export type RouterRedirectToOption = MiniProgramRouterRedirectToOption

export type MiniProgramRouterNavigateToOption = Omit<WechatMiniprogram.NavigateToOption, 'url'> & {
  url: TypedRouterUrl
}
export type RouterNavigateToOption = MiniProgramRouterNavigateToOption

/**
 * setup 场景下推荐使用的 Router 类型。
 * 默认行为与原生 Router 一致；声明合并后可获得更精确的 `url` 类型提示。
 */
export interface SetupContextRouter {
  switchTab: (option: MiniProgramRouterSwitchTabOption) => ReturnType<MiniProgramRouter['switchTab']>
  reLaunch: (option: MiniProgramRouterReLaunchOption) => ReturnType<MiniProgramRouter['reLaunch']>
  redirectTo: (option: MiniProgramRouterRedirectToOption) => ReturnType<MiniProgramRouter['redirectTo']>
  navigateTo: (option: MiniProgramRouterNavigateToOption) => ReturnType<MiniProgramRouter['navigateTo']>
  navigateBack: MiniProgramRouter['navigateBack']
}
