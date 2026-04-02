import type { SetupContextRouter } from '../types'
import { getCurrentSetupContext } from '../hooks'
import { getMiniProgramGlobalObject } from '../platform'

type RuntimeRouter = SetupContextRouter
type RuntimeRouterMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'
type RuntimeRouterAccessor = 'router' | 'pageRouter'

const RUNTIME_ROUTER_METHODS: RuntimeRouterMethodName[] = ['switchTab', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack']

function isRuntimeRouter(candidate: unknown): candidate is RuntimeRouter {
  if (!candidate || typeof candidate !== 'object') {
    return false
  }
  return RUNTIME_ROUTER_METHODS.every((methodName) => {
    return typeof (candidate as Record<string, any>)[methodName] === 'function'
  })
}

function createGlobalRouterFallback(): RuntimeRouter | undefined {
  const miniProgramGlobal = getMiniProgramGlobalObject()
  if (!miniProgramGlobal) {
    return undefined
  }
  const fallbackRouter = Object.create(null) as RuntimeRouter
  for (const methodName of RUNTIME_ROUTER_METHODS) {
    const handler = (miniProgramGlobal as Record<string, any>)[methodName]
    if (typeof handler !== 'function') {
      return undefined
    }
    ;(fallbackRouter as Record<string, any>)[methodName] = (...args: any[]) => handler.apply(miniProgramGlobal, args)
  }
  return fallbackRouter
}

function useRuntimeRouterByAccessor(
  primaryAccessor: RuntimeRouterAccessor,
  fallbackAccessor: RuntimeRouterAccessor,
  helperName: 'useNativeRouter' | 'useNativePageRouter',
): RuntimeRouter {
  const ctx = getCurrentSetupContext<any>()
  if (!ctx?.instance) {
    throw new Error(`${helperName}() 必须在 setup() 的同步阶段调用`)
  }

  const nativeInstance = ctx.instance as Record<string, any>
  const primaryRouter = nativeInstance[primaryAccessor]
  if (isRuntimeRouter(primaryRouter)) {
    return primaryRouter
  }

  const fallbackRouter = nativeInstance[fallbackAccessor]
  if (isRuntimeRouter(fallbackRouter)) {
    return fallbackRouter
  }

  const globalFallbackRouter = createGlobalRouterFallback()
  if (globalFallbackRouter) {
    return globalFallbackRouter
  }

  throw new Error('当前运行环境不支持 Router，请升级微信基础库到 2.16.1+ 或检查平台路由能力')
}

/**
 * 在 setup 中获取与当前组件路径语义一致的原生 Router 对象。
 *
 * - 优先使用实例上的 `this.router`（组件路径语义）。
 * - 不可用时回退到 `this.pageRouter`。
 * - 低版本基础库再回退到全局 `wx.*` 路由方法。
 *
 * 如需更贴近 Vue Router 的高阶能力（导航守卫、失败类型、统一解析），
 * 推荐改用 `wevu/router` 子入口的 `useRouter()`。
 */
export function useNativeRouter(): RuntimeRouter {
  return useRuntimeRouterByAccessor('router', 'pageRouter', 'useNativeRouter')
}

/**
 * 在 setup 中获取与当前页面路径语义一致的原生 Router 对象。
 *
 * - 优先使用实例上的 `this.pageRouter`（页面路径语义）。
 * - 不可用时回退到 `this.router`。
 * - 低版本基础库再回退到全局 `wx.*` 路由方法。
 *
 * 如需更贴近 Vue Router 的高阶能力（导航守卫、失败类型、统一解析），
 * 推荐改用 `wevu/router` 子入口的 `useRouter()`。
 */
export function useNativePageRouter(): RuntimeRouter {
  return useRuntimeRouterByAccessor('pageRouter', 'router', 'useNativePageRouter')
}
