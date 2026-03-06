import type {
  LocationQuery,
  NavigationAfterEachContext,
  NavigationFailure,
  NavigationGuardContext,
  NavigationRedirect,
  RouteLocationNormalizedLoaded,
  RouterNavigation,
  UseRouterNavigationOptions,
} from 'wevu/router'
import { expectType } from 'tsd'
import {
  createNavigationFailure,
  isNavigationFailure,
  NavigationFailureType,
  parseQuery,
  resolveRouteLocation,
  stringifyQuery,
  useRoute,
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

const navigationOptions: UseRouterNavigationOptions = {
  tabBarEntries: ['pages/home/index'],
}
const navigation = useRouterNavigation(navigationOptions)
expectType<RouterNavigation>(navigation)

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

const failure = createNavigationFailure(NavigationFailureType.cancelled)
expectType<NavigationFailure>(failure)
expectType<boolean>(isNavigationFailure(failure))

const redirect: NavigationRedirect = {
  to: '/pages/login/index',
  replace: true,
}
expectType<NavigationRedirect>(redirect)
