import { expectError } from 'tsd'
import { defineComponent, useNativePageRouter, useNativeRouter } from '@/index'

declare module '@/index' {
  interface WevuTypedRouterRouteMap {
    entries: 'pages/home/index' | 'packageA/pages/cat'
    tabBarEntries: 'pages/home/index'
  }
}

defineComponent({
  setup() {
    const router = useNativeRouter()
    const pageRouter = useNativePageRouter()

    router.navigateTo({ url: 'pages/home/index' })
    router.navigateTo({ url: '/pages/home/index' })
    router.navigateTo({ url: 'pages/home/index?scene=1' })
    pageRouter.redirectTo({ url: '/packageA/pages/cat?from=demo' })
    pageRouter.reLaunch({ url: './detail' })
    router.switchTab({ url: 'pages/home/index' })
    router.switchTab({ url: '/pages/home/index' })

    expectError(router.navigateTo({ url: '/pages/unknown/index' }))
    expectError(pageRouter.reLaunch({ url: 'feature/unknown/index' }))
    expectError(router.switchTab({ url: './detail' }))
    expectError(router.switchTab({ url: '/pages/home/index?scene=1' }))
    expectError(router.switchTab({ url: '/packageA/pages/cat' }))

    return {}
  },
})
