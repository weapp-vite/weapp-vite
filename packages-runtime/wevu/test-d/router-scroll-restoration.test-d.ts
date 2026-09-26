import type { RouteLocationNormalizedLoaded, ScrollRestorationController, ScrollRestorationHandle, ScrollViewRestorationHandle } from 'wevu/router'
import { expectError, expectType } from 'tsd'
import { createRouter, createScrollRestoration, usePageScrollRestoration, useScrollRestoration, useScrollViewRestoration } from 'wevu/router'

interface RouteMap {
  list: { path: '/pages/list/index', params: Record<string, never>, meta: { title: string } }
}

const router = createRouter<RouteMap>()
const controller = createScrollRestoration({ router, onError: error => expectType<unknown>(error) })
expectType<ScrollRestorationController>(controller)
expectType<boolean>(controller.automatic)
expectType<void>(controller.clear('/pages/list/index?id=1'))
expectType<void>(controller.dispose())
expectError(controller.automatic = false)

const handle = useScrollRestoration({
  controller,
  id: 'results',
  key: (route) => {
    expectType<Readonly<RouteLocationNormalizedLoaded>>(route)
    return route.fullPath
  },
  manual: true,
  capture: () => ({ main: 120, sidebar: 30, selectedId: 'item-7' }),
  async restore(snapshot, context) {
    expectType<{ main: number, sidebar: number, selectedId: string } | undefined>(snapshot)
    expectType<string | undefined>(context.routeEventId)
    expectType<Readonly<RouteLocationNormalizedLoaded>>(context.route)
    expectType<boolean>(context.isActive())
  },
})
expectType<ScrollRestorationHandle>(handle)
expectType<Promise<boolean>>(handle.scroll())
expectType<void>(handle.clear())
expectType<void>(handle.stop())

const page = usePageScrollRestoration({ controller, id: 'document' })
expectType<ScrollRestorationHandle>(page)
const view = useScrollViewRestoration({ controller, id: 'list' })
expectType<ScrollViewRestorationHandle>(view)
expectType<number>(view.scrollTop.value)
expectType<number>(view.scrollLeft.value)
expectType<void>(view.onScroll({ detail: { scrollTop: 120, scrollLeft: 45 } }))

expectError(useScrollRestoration({ capture: async () => ({ top: 0 }), restore: () => {} }))
expectError(useScrollRestoration<{ top: number }>({ capture: () => ({ top: 'invalid' }), restore: () => {} }))
expectError(useScrollRestoration({ key: () => 42, capture: () => ({ top: 0 }), restore: () => {} }))
expectError(useScrollRestoration({ capture: () => ({ top: 0 }), restore: () => 42 }))
expectError(view.onScroll({ detail: { scrollTop: '120', scrollLeft: 0 } }))
