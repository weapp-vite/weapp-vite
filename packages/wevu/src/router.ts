import { parseQuery, stringifyQuery } from './routerInternal/shared'

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
  RouteRecordMatched,
  RouteRecordRaw,
  RouteRecordRedirect,
  RouterNavigation,
  UseRouterOptions,
} from './router/types'
export {
  useNativePageRouter,
  useNativeRouter,
  useRoute,
} from './router/useRoute'

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
