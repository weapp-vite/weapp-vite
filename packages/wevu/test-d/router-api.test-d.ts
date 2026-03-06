import type {
  LocationQuery,
  NavigationAfterEachContext,
  NavigationErrorContext,
  NavigationFailure,
  NavigationGuardContext,
  NavigationRedirect,
  RouteLocationNormalizedLoaded,
  RouterNavigation,
  SetupContextRouter,
  UseRouterOptions,
} from 'wevu/router'
import { expectType } from 'tsd'
import {
  createNavigationFailure,
  isNavigationFailure,
  NavigationFailureType,
  parseQuery,
  resolveRouteLocation,
  stringifyQuery,
  useNativePageRouter,
  useNativeRouter,
  useRoute,
  useRouter,
  useRouterNavigation,
} from 'wevu/router'

const parsed = parseQuery('?foo=1&flag')
expectType<LocationQuery>(parsed)

const serialized = stringifyQuery({
  foo: '1',
  flag: null,
  count: 1,
  enabled: true,
})
expectType<string>(serialized)

const resolved = resolveRouteLocation('./detail?tab=all', 'pages/home/index')
expectType<RouteLocationNormalizedLoaded>(resolved)

const route = useRoute()
expectType<Readonly<RouteLocationNormalizedLoaded>>(route)

const navigationOptions: UseRouterOptions = {
  tabBarEntries: ['pages/home/index'],
}
const navigation = useRouter(navigationOptions)
expectType<RouterNavigation>(navigation)
expectType<RouterNavigation>(useRouterNavigation(navigationOptions))
expectType<SetupContextRouter>(useNativeRouter())
expectType<SetupContextRouter>(useNativePageRouter())

const removeGuard = navigation.beforeEach((context: NavigationGuardContext) => {
  expectType<'push' | 'replace' | 'back'>(context.mode)
  expectType<RouteLocationNormalizedLoaded | undefined>(context.to)
  expectType<RouteLocationNormalizedLoaded>(context.from)
  return true
})
expectType<() => void>(removeGuard)

const removeResolveGuard = navigation.beforeResolve((context: NavigationGuardContext) => {
  expectType<RouteLocationNormalizedLoaded | undefined>(context.to)
  return {
    to: '/pages/login/index?from=guard',
    replace: true,
  }
})
expectType<() => void>(removeResolveGuard)

const removeAfterEach = navigation.afterEach((context: NavigationAfterEachContext) => {
  expectType<'push' | 'replace' | 'back'>(context.mode)
  expectType<RouteLocationNormalizedLoaded | undefined>(context.to)
  expectType<RouteLocationNormalizedLoaded>(context.from)
  expectType<NavigationFailure | undefined>(context.failure)
})
expectType<() => void>(removeAfterEach)

const removeOnError = navigation.onError((error, context: NavigationErrorContext) => {
  expectType<unknown>(error)
  expectType<'push' | 'replace' | 'back'>(context.mode)
  expectType<RouteLocationNormalizedLoaded | undefined>(context.to)
  expectType<RouteLocationNormalizedLoaded>(context.from)
  expectType<NavigationFailure>(context.failure)
})
expectType<() => void>(removeOnError)

const failure = createNavigationFailure(NavigationFailureType.cancelled)
expectType<NavigationFailure>(failure)
expectType<boolean>(isNavigationFailure(failure))

const redirect: NavigationRedirect = {
  to: '/pages/login/index',
  replace: true,
}
expectType<NavigationRedirect>(redirect)
