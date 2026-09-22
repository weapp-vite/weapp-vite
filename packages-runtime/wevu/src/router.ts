import type { StaticPageDeclaration } from '@wevu/compiler/page-route'

import { parseQuery, stringifyQuery } from './routerInternal/shared'

/**
 * 由 weapp-vite 生成的项目级命名路由声明会扩展此接口。
 */
export interface WevuNamedRouteMap {}

/**
 * definePage 声明页面命名路由（仅编译期宏，无运行时实现）。
 *
 * `name` 必须是应用内唯一的非空静态字符串，`meta` 仅支持有限 JSON 对象。
 * 参数只接受 `name` 与 `meta`；页面布局继续使用 `definePageMeta`，页面路径由构建工具推导。
 */
export declare function definePage(route: StaticPageDeclaration): void

export { parseQuery, stringifyQuery }
export {
  createRouter,
} from './router/createRouter'
export {
  createNavigationFailure,
  isNavigationFailure,
} from './router/navigationCore'
export { resolveRouteLocation } from './router/resolve'
export { NavigationFailureType } from './router/types'
export type {
  AddRoute,
  InitialNavigationMode,
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
  LocationQueryValueRaw,
  NamedRouteRecord,
  NamedRoutes,
  NavigationAfterEach,
  NavigationAfterEachContext,
  NavigationErrorContext,
  NavigationErrorHandler,
  NavigationFailure,
  NavigationFailureTypeValue,
  NavigationGuard,
  NavigationGuardContext,
  NavigationGuardResult,
  NavigationMode,
  NavigationRedirect,
  RouteLocationNamedRaw,
  RouteLocationNormalizedByName,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
  RouteLocationRedirectedFrom,
  RouteMeta,
  RouteParams,
  RouteParamsMode,
  RouteParamsRaw,
  RouteParamValue,
  RouteParamValueRaw,
  RouteQueryParser,
  RouteQueryStringifier,
  RouteRecordInput,
  RouteRecordMatched,
  RouteRecordRaw,
  RouteRecordRedirect,
  RouterNavigation,
  RouterResolve,
  UseRouterOptions,
  WevuAutoRoute,
  WevuBroadRouteMap,
  WevuNamedRouteDefinition,
  WevuNamedRouteMeta,
  WevuNamedRoutePath,
  WevuRouteName,
} from './router/types'
export {
  useNativePageRouter,
  useNativeRouter,
  useRoute,
} from './router/useRoute'
export type { UseRouteOptions } from './router/useRoute'

export { useRouter } from './router/useRouter'
export type {
  RouterNavigateToOption,
  RouterRedirectToOption,
  RouterReLaunchOption,
  RouterSwitchTabOption,
  SetupContextRouter,
  TypedRouterTabBarUrl,
  TypedRouterUrl,
  WevuTypedRouterRouteMap,
} from './runtime/types/props'

export type {
  StaticPageDeclaration,
  StaticRouteValue,
} from '@wevu/compiler/page-route'
