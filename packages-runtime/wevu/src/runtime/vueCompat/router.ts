import type { SetupContextRouter } from '../types'
import { parsePathInput } from '../../routerInternal/location'
import { createAbsoluteRoutePath, resolvePath, stringifyQuery } from '../../routerInternal/shared'
import { getCurrentSetupContext } from '../hooks'
import { getMiniProgramGlobalObject } from '../platform'

type RuntimeRouter = SetupContextRouter
type RuntimeRouterMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'
type RuntimeRouterAccessor = 'router' | 'pageRouter'

const RUNTIME_ROUTER_METHODS: RuntimeRouterMethodName[] = ['switchTab', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack']
const runtimeRouterWrapperCache = new WeakMap<RuntimeRouter, Map<string, RuntimeRouter>>()

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

function resolveBasePathCandidate(candidate: unknown): string | undefined {
  if (typeof candidate !== 'string' || !candidate) {
    return undefined
  }
  const normalized = resolvePath(candidate, '')
  return normalized || undefined
}

function resolveRouterBasePath(
  nativeInstance: Record<string, any>,
  accessor: RuntimeRouterAccessor,
): string | undefined {
  const candidates = accessor === 'pageRouter'
    ? [nativeInstance.route, nativeInstance.__route__, nativeInstance.is]
    : [nativeInstance.is, nativeInstance.route, nativeInstance.__route__]

  for (const candidate of candidates) {
    const resolved = resolveBasePathCandidate(candidate)
    if (resolved) {
      return resolved
    }
  }

  return undefined
}

function resolveScopedRouterUrl(url: string, basePath?: string): string {
  if (!basePath || (!url.startsWith('./') && !url.startsWith('../'))) {
    return url
  }

  const { path, query, hash } = parsePathInput(url)
  const resolvedPath = createAbsoluteRoutePath(resolvePath(path, basePath))
  const queryString = stringifyQuery(query)
  return `${resolvedPath}${queryString ? `?${queryString}` : ''}${hash}`
}

function createScopedRuntimeRouter(rawRouter: RuntimeRouter, basePath?: string): RuntimeRouter {
  const cacheKey = basePath ?? ''
  const cachedByBasePath = runtimeRouterWrapperCache.get(rawRouter)
  const cachedRouter = cachedByBasePath?.get(cacheKey)
  if (cachedRouter) {
    return cachedRouter
  }

  const scopedRouter = Object.create(null) as RuntimeRouter
  for (const methodName of RUNTIME_ROUTER_METHODS) {
    ;(scopedRouter as Record<string, any>)[methodName] = (option: Record<string, any>) => {
      const rawMethod = (rawRouter as Record<string, any>)[methodName]
      if (methodName === 'navigateBack' || !option || typeof option !== 'object') {
        return rawMethod.call(rawRouter, option)
      }

      const nextUrl = typeof option.url === 'string'
        ? resolveScopedRouterUrl(option.url, basePath)
        : option.url
      const nextOption = nextUrl === option.url
        ? option
        : { ...option, url: nextUrl }
      return rawMethod.call(rawRouter, nextOption)
    }
  }

  const nextCache = cachedByBasePath ?? new Map<string, RuntimeRouter>()
  nextCache.set(cacheKey, scopedRouter)
  runtimeRouterWrapperCache.set(rawRouter, nextCache)
  return scopedRouter
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
  const basePath = resolveRouterBasePath(nativeInstance, primaryAccessor)
  const primaryRouter = nativeInstance[primaryAccessor]
  if (isRuntimeRouter(primaryRouter)) {
    return createScopedRuntimeRouter(primaryRouter, basePath)
  }

  const fallbackRouter = nativeInstance[fallbackAccessor]
  if (isRuntimeRouter(fallbackRouter)) {
    return createScopedRuntimeRouter(fallbackRouter, basePath)
  }

  const globalFallbackRouter = createGlobalRouterFallback()
  if (globalFallbackRouter) {
    return createScopedRuntimeRouter(globalFallbackRouter, basePath)
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
