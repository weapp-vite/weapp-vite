import type {
  LocationQuery,
  NavigationFailure,
  RouteLocationNormalizedLoaded,
  RouterNavigation,
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

const navigation = useRouterNavigation()
expectType<RouterNavigation>(navigation)

const failure = createNavigationFailure(NavigationFailureType.cancelled)
expectType<NavigationFailure>(failure)
expectType<boolean>(isNavigationFailure(failure))
