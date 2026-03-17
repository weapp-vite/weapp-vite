import type { AutoRoutes, AutoRoutesSubPackage } from './types/routes'
import { getCompilerContext } from './context'

type RouteMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'
type RouteOption = Record<string, any> | undefined
const ROUTE_RUNTIME_OVERRIDE_KEY = Symbol.for('weapp-vite.route-runtime')

function createGetter<T>(resolver: () => T) {
  return {
    configurable: false,
    enumerable: true,
    get: resolver,
  } as const
}

const ctx = getCompilerContext()
const service = ctx.autoRoutesService

const routes = {} as AutoRoutes
Object.defineProperties(routes, {
  pages: createGetter(() => {
    return service?.getReference().pages ?? []
  }),
  entries: createGetter(() => {
    return service?.getReference().entries ?? []
  }),
  subPackages: createGetter(() => {
    return service?.getReference().subPackages ?? []
  }),
})

const pages = routes.pages
const entries = routes.entries
const subPackages = routes.subPackages

function resolveMiniProgramGlobal() {
  const runtime = globalThis as Record<string | symbol, any>
  const overrideRuntime = runtime[ROUTE_RUNTIME_OVERRIDE_KEY]
  if (overrideRuntime) {
    return overrideRuntime
  }
  return runtime.wx ?? runtime.tt ?? runtime.my
}

function callRouteMethod(methodName: RouteMethodName, option?: RouteOption) {
  const miniProgramGlobal = resolveMiniProgramGlobal()
  const routeMethod = miniProgramGlobal?.[methodName]
  if (typeof routeMethod !== 'function') {
    throw new TypeError(`[weapp-vite] 当前运行环境不支持路由方法: ${methodName}`)
  }
  if (option === undefined) {
    return routeMethod.call(miniProgramGlobal)
  }
  return routeMethod.call(miniProgramGlobal, option)
}

export interface AutoRoutesWxRouter {
  switchTab: (option: Record<string, any>) => unknown
  reLaunch: (option: Record<string, any>) => unknown
  redirectTo: (option: Record<string, any>) => unknown
  navigateTo: (option: Record<string, any>) => unknown
  navigateBack: (option?: Record<string, any>) => unknown
}

const wxRouter: AutoRoutesWxRouter = {
  switchTab(option) {
    return callRouteMethod('switchTab', option)
  },
  reLaunch(option) {
    return callRouteMethod('reLaunch', option)
  },
  redirectTo(option) {
    return callRouteMethod('redirectTo', option)
  },
  navigateTo(option) {
    return callRouteMethod('navigateTo', option)
  },
  navigateBack(option) {
    return callRouteMethod('navigateBack', option)
  },
}

export type { AutoRoutes, AutoRoutesSubPackage }
export { entries, pages, routes, subPackages, wxRouter }
export default routes
