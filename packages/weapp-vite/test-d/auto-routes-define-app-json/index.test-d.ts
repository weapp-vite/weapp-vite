import { expectError, expectType } from 'tsd'
import routes, { pages } from 'weapp-vite/auto-routes'
import './index'

const appJsonFromRoutes = defineAppJson({
  pages: routes.pages,
  window: {
    navigationBarTitleText: 'auto-routes',
  },
})

const appJsonFromPages = defineAppJson({
  pages,
  window: {
    navigationBarTitleText: 'auto-routes',
  },
})

expectType<['pages/home/index', 'pages/logs/index']>(routes.pages)
expectType<['pages/home/index', 'pages/logs/index']>(pages)
expectType<string[] | undefined>(appJsonFromRoutes.pages)
expectType<string[] | undefined>(appJsonFromPages.pages)

expectError(defineAppJson({
  pages: [123],
}))
