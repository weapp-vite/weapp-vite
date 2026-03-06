import { expectError, expectType } from 'tsd'
import { defineComponent, usePageRouter, useRouter } from '@/index'

declare module '@/index' {
  interface WevuTypedRouterRouteMap {
    entries: 'pages/home/index' | 'packageA/pages/cat'
  }
}

defineComponent({
  setup() {
    const router = useRouter()
    const pageRouter = usePageRouter()

    expectType<void>(router.navigateTo({ url: 'pages/home/index' }))
    expectType<void>(router.navigateTo({ url: '/pages/home/index' }))
    expectType<void>(router.navigateTo({ url: 'pages/home/index?scene=1' }))
    expectType<void>(pageRouter.redirectTo({ url: '/packageA/pages/cat?from=demo' }))
    expectType<void>(pageRouter.reLaunch({ url: './detail' }))

    expectError(router.navigateTo({ url: '/pages/unknown/index' }))
    expectError(pageRouter.reLaunch({ url: 'feature/unknown/index' }))

    return {}
  },
})
