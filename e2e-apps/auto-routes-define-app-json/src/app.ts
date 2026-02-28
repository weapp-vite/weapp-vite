// @ts-expect-error e2e 用于触发 auto-routes 虚拟模块加载
import routes from 'virtual:weapp-vite-auto-routes'

App({
  globalData: {
    __autoRoutesPages: routes.pages,
  },
})
