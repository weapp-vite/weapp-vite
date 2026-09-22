/* eslint-disable ts/no-empty-object-type -- 空页面元信息与生成的 meta: {} 声明保持一致。 */
import type {
  NavigationErrorContext,
  NavigationFailure,
  RouteLocationNormalizedLoaded,
  RouteMeta,
  StaticPageDeclaration,
  WevuAutoRoute,
  WevuBroadRouteMap,
  WevuNamedRouteMap,
} from 'wevu/router'
import type { WevuAutoRoutes } from 'wevu/router/auto-routes'
import { expectAssignable, expectError, expectType } from 'tsd'
import { definePageMeta } from 'wevu'
import {
  createNavigationFailure,
  createRouter,
  NavigationFailureType,
  resolveRouteLocation,
  useRoute,
  useRouter,
} from 'wevu/router'
import { routes } from 'wevu/router/auto-routes'

declare module 'wevu/router' {
  interface WevuNamedRouteMap {
    home: {
      path: '/pages/home/index'
      meta: {
        title: string
        tags: string[]
        access: {
          admin: boolean
          scopes: (string | null)[]
        }
      }
    }
    settings: {
      path: '/packageA/pages/settings/index'
      meta: {
        section: string
        depth: number
      }
    }
    plain: {
      path: '/pages/plain/index'
      meta: {}
    }
  }
}

expectAssignable<StaticPageDeclaration>({
  name: 'home',
  meta: {
    title: '首页',
    tags: ['main'],
    access: {
      admin: true,
      scopes: ['read', null],
    },
  },
})
definePageMeta({ route: { name: 'plain' } })
expectError(definePageMeta({ route: { name: 'invalid', meta: { missing: undefined } } }))
expectError(definePageMeta({ route: { name: 'invalid', meta: { handler: () => true } } }))

expectAssignable<readonly WevuAutoRoute<WevuNamedRouteMap>[]>(routes)
expectType<WevuAutoRoutes>(routes)

const router = createRouter({ routes })
expectType<typeof router>(useRouter())

const resolvedHome = router.resolve({ name: 'home' })
expectType<'home'>(resolvedHome.name)
expectType<string>(resolvedHome.meta.title)
expectType<string[]>(resolvedHome.meta.tags)
expectType<boolean>(resolvedHome.meta.access.admin)
expectType<(string | null)[]>(resolvedHome.meta.access.scopes)
expectError(resolvedHome.meta.section)

declare const selectedName: 'home' | 'settings'
const resolvedSelected = router.resolve({ name: selectedName })
if (resolvedSelected.name === 'home') {
  expectType<string>(resolvedSelected.meta.title)
  expectError(resolvedSelected.meta.section)
}
else {
  expectType<string>(resolvedSelected.meta.section)
  expectError(resolvedSelected.meta.title)
}

const currentRoute = router.currentRoute
if (currentRoute.name === 'settings') {
  expectType<string>(currentRoute.meta.section)
  expectType<number>(currentRoute.meta.depth)
  expectError(currentRoute.meta.title)
}
else if (currentRoute.name === 'home') {
  expectType<string>(currentRoute.meta.title)
  expectError(currentRoute.meta.section)
}
else if (currentRoute.name === undefined) {
  expectType<RouteMeta | undefined>(currentRoute.meta)
}

const setupRoute = useRoute()
if (setupRoute.name === 'plain') {
  expectError(setupRoute.meta.section)
  expectType<{}>(setupRoute.meta)
}

router.beforeEach((to, from, context) => {
  if (to?.name === 'home') {
    expectType<string>(to.meta.title)
    expectError(to.meta.section)
  }
  if (to === undefined) {
    expectType<undefined>(to)
  }
  if (from.name === 'settings') {
    expectType<number>(from.meta.depth)
  }
  if (context?.to?.name === 'plain') {
    expectType<{}>(context.to.meta)
  }
  return { name: 'settings' }
})

router.beforeResolve((to) => {
  if (to?.redirectedFrom?.name === 'home') {
    expectType<string>(to.redirectedFrom.meta.title)
    expectError(to.redirectedFrom.meta.section)
  }
})

router.afterEach((to, from, failure, context) => {
  if (to?.name === 'settings') {
    expectType<string>(to.meta.section)
  }
  if (from.name === 'home') {
    expectType<string>(from.meta.title)
  }
  if (failure?.to?.name === 'plain') {
    expectType<{}>(failure.to.meta)
  }
  if (context?.failure?.from?.name === 'settings') {
    expectType<number>(context.failure.from.meta.depth)
  }
})

router.onError((_error, context: NavigationErrorContext) => {
  if (context.to?.name === 'home') {
    expectType<string>(context.to.meta.title)
  }
  if (context.failure.from?.name === 'settings') {
    expectType<number>(context.failure.from.meta.depth)
  }
})

const removeHome = router.addRoute({
  name: 'home',
  path: '/pages/home/index',
  meta: {
    title: '首页',
    tags: ['main'],
    access: {
      admin: true,
      scopes: ['read', null],
    },
  },
  redirect(to, from) {
    if (to.name === 'home') {
      expectType<string>(to.meta.title)
    }
    if (from.name === 'settings') {
      expectType<string>(from.meta.section)
    }
    return { name: 'settings' }
  },
})
expectType<() => void>(removeHome)
router.addRoute({
  name: 'home',
  path: '/pages/home/index',
  meta: {
    title: '首页',
    tags: [],
    access: { admin: false, scopes: [] },
  },
  children: [{
    name: 'settings',
    path: '/packageA/pages/settings/index',
    meta: {
      section: 'account',
      depth: 1,
    },
  }],
})

expectError(router.addRoute({
  name: 'home',
  path: '/pages/wrong/index',
  meta: {
    title: '首页',
    tags: [],
    access: { admin: true, scopes: [] },
  },
}))
expectError(router.addRoute({
  name: 'home',
  path: '/pages/home/index',
  meta: {
    title: '首页',
    tags: [],
    access: { admin: true, scopes: [] },
    section: 'settings-only',
  },
}))
expectError(router.addRoute({
  name: 'missing',
  path: '/pages/missing/index',
  meta: {},
}))
expectError(router.addRoute('missing', {
  name: 'plain',
  path: '/pages/plain/index',
  meta: {},
}))

expectError(router.addRoute({
  name: 'plain',
  path: '/pages/plain/index',
}))
expectError(router.addRoute({
  name: 'plain',
  path: '/pages/plain/index',
  meta: { section: 'settings-only' },
}))
expectType<boolean>(router.hasRoute('home'))
expectType<void>(router.removeRoute('settings'))
expectError(router.hasRoute('missing'))
expectError(router.removeRoute('missing'))

for (const record of router.getRoutes()) {
  if (record.name === 'settings') {
    expectType<'/packageA/pages/settings/index'>(record.path)
    expectType<string>(record.meta.section)
    expectError(record.meta.title)
  }
}

router.push({ name: 'home' })
router.replace({ path: '/pages/plain/index' })
router.resolve({ query: { source: 'current' } })
const unannotatedRoute = router.resolve('/pages/unannotated/index')
if (unannotatedRoute.name === undefined) {
  expectType<RouteMeta | undefined>(unannotatedRoute.meta)
}
expectError(router.push({ name: 'missing' }))
expectError(router.push({ name: 'home', path: '/pages/home/index' }))
expectError(router.replace({ name: 'settings', fullPath: '/packageA/pages/settings/index' }))

const broadRouter = createRouter<WevuBroadRouteMap>({
  namedRoutes: {
    legacy: '/pages/legacy/index',
  },
})
broadRouter.push({ name: 'runtime-name', path: '/pages/runtime/index' })
broadRouter.addRoute({
  name: 'runtime-name',
  path: '/pages/runtime/index',
  meta: { consumerOwned: true },
})
expectType<boolean>(broadRouter.hasRoute('unknown-at-build-time'))
expectType<typeof broadRouter>(useRouter<WevuBroadRouteMap>())
expectType<string | undefined>(useRoute<WevuBroadRouteMap>().name)

const strictFailure = createNavigationFailure(NavigationFailureType.aborted, router.currentRoute)
expectType<NavigationFailure>(strictFailure)
if (strictFailure.to?.name === 'home') {
  expectType<string>(strictFailure.to.meta.title)
  expectError(strictFailure.to.meta.section)
}
const broadFailure = createNavigationFailure<WevuBroadRouteMap>(NavigationFailureType.aborted, broadRouter.currentRoute)
expectType<NavigationFailure<WevuBroadRouteMap>>(broadFailure)
expectError(createNavigationFailure(NavigationFailureType.aborted, broadRouter.currentRoute))

const standalone = resolveRouteLocation({ path: '/pages/runtime/index', name: 'runtime-name' })
expectType<RouteLocationNormalizedLoaded<WevuBroadRouteMap>>(standalone)
