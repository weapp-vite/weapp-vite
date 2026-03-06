import type { LocationQuery, RouteLocationNormalizedLoaded } from 'wevu/router'
import { expectType } from 'tsd'
import { parseQuery, resolveRouteLocation, stringifyQuery, useRoute } from 'wevu/router'

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
