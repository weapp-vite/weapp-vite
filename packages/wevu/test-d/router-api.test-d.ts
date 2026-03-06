import type {
  LocationQuery,
  NamedRouteRecord,
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

const resolvedWithMeta = resolveRouteLocation({
  path: '/pages/post/index',
  hash: 'comment',
  name: 'post-detail',
  params: {
    id: 1,
    tags: ['news', true],
  },
})
expectType<RouteLocationNormalizedLoaded>(resolvedWithMeta)

const route = useRoute()
expectType<Readonly<RouteLocationNormalizedLoaded>>(route)

const navigationOptions: UseRouterOptions = {
  tabBarEntries: ['pages/home/index'],
  namedRoutes: {
    'home': '/pages/home/index',
    'post-detail': '/pages/post/:id/index',
  },
  parseQuery: (search) => {
    return {
      from: search || null,
    }
  },
  stringifyQuery: (query) => {
    const from = (query as Record<string, unknown>).from
    return typeof from === 'string' ? `from=${from}` : ''
  },
  rejectOnError: true,
}
const navigation = useRouter(navigationOptions)
expectType<RouterNavigation>(navigation)
expectType<SetupContextRouter>(useNativeRouter())
expectType<SetupContextRouter>(useNativePageRouter())
expectType<boolean>(navigation.hasRoute('home'))
expectType<readonly NamedRouteRecord[]>(navigation.getRoutes())
const removeDynamicRoute = navigation.addRoute({
  name: 'dynamic-post',
  path: '/pages/post/:id/index',
})
expectType<() => void>(removeDynamicRoute)
expectType<void>(navigation.removeRoute('dynamic-post'))

const resolvedByName = navigation.resolve({
  name: 'post-detail',
  params: {
    id: 1,
  },
  query: {
    from: 'feed',
  },
})
expectType<RouteLocationNormalizedLoaded>(resolvedByName)
expectType<string | undefined>(resolvedByName.name)

const removeGuard = navigation.beforeEach((to, from, context) => {
  expectType<RouteLocationNormalizedLoaded | undefined>(to)
  expectType<RouteLocationNormalizedLoaded>(from)
  expectType<NavigationGuardContext | undefined>(context)
  return true
})
expectType<() => void>(removeGuard)

const removeResolveGuard = navigation.beforeResolve((to, from, context) => {
  expectType<RouteLocationNormalizedLoaded | undefined>(to)
  expectType<RouteLocationNormalizedLoaded>(from)
  expectType<NavigationGuardContext | undefined>(context)
  return {
    to: '/pages/login/index?from=guard',
    replace: true,
  }
})
expectType<() => void>(removeResolveGuard)

const removeAfterEach = navigation.afterEach((to, from, failure, context) => {
  expectType<RouteLocationNormalizedLoaded | undefined>(to)
  expectType<RouteLocationNormalizedLoaded>(from)
  expectType<NavigationFailure | undefined>(failure)
  expectType<NavigationAfterEachContext | undefined>(context)
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
