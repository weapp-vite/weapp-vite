import type {
  LocationQuery,
  NavigationFailure,
  NavigationGuardContext,
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

const failure = createNavigationFailure(NavigationFailureType.cancelled)
expectType<NavigationFailure>(failure)
expectType<boolean>(isNavigationFailure(failure))
