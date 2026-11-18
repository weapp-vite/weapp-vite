import type { RouterHistory, RouterHistoryAdapter, RouterHistoryContextBase, RouterHistoryHooks } from './history'
import { createAbsoluteRoutePath, createNativeRouteUrl, hasLocationQuery, resolvePageRoute } from '../routerInternal/shared'
import { resolveBackNavigationTarget } from './backNavigation'
import { executeNavigationMethod } from './navigationCore'
import { createDuplicatedFailure, createForwardNotSupportedFailure, createHashOnlyNavigationFailure, createTabBarQueryFailure } from './navigationTargetHelpers'

/** 小程序原生历史配置，使用宿主页面栈导航。 */
export interface MiniProgramHistory extends RouterHistory {
  readonly syncWithNative: true
}

/** 创建原生历史配置；不做任何额外处理，全部走宿主页面栈。 */
export function createMiniProgramHistory(): MiniProgramHistory {
  return Object.freeze({
    syncWithNative: true,
    create: () => ({}),
  } satisfies MiniProgramHistory)
}

/**
 * 创建原生适配器，供钩子未拦截时执行，避免原生行为被重复委托。
 * readLocation 读取的是最终位置（含自定义覆盖），仅用于返回目标解析。
 */
export function createMiniProgramHistoryAdapter(
  { nativeRouter, tabBarPaths, stringifyQuery, resolve }: RouterHistoryContextBase,
  readLocation: RouterHistoryAdapter['readLocation'] = resolvePageRoute,
): RouterHistoryAdapter {
  function write(mode: 'push' | 'replace', to: Parameters<typeof createNativeRouteUrl>[0], from: Parameters<typeof createNativeRouteUrl>[0]) {
    const tab = tabBarPaths.has(to.path)
    const method = tab ? nativeRouter.switchTab : mode === 'push' ? nativeRouter.navigateTo : nativeRouter.redirectTo
    return executeNavigationMethod(method as (options: Record<string, any>) => unknown, {
      url: tab ? createAbsoluteRoutePath(to.path) : createNativeRouteUrl(to, stringifyQuery),
    }, to, from)
  }
  return {
    readLocation: resolvePageRoute,
    readResolvedLocation: location => location,
    resetLocation() {},
    check(to, from, allowSameLocation) {
      const tab = tabBarPaths.has(to.path)
      if (createNativeRouteUrl(to, stringifyQuery) === createNativeRouteUrl(from, stringifyQuery) && to.hash !== from.hash) {
        return createHashOnlyNavigationFailure(to, from)
      }
      if (!allowSameLocation && (tab ? to.path === from.path : to.fullPath === from.fullPath)) {
        return createDuplicatedFailure(to, from)
      }
      if (tab && hasLocationQuery(to.query)) {
        return createTabBarQueryFailure(to, from)
      }
    },
    push: (to, from) => write('push', to, from),
    replace: (to, from) => write('replace', to, from),
    resolveGo(delta, from) {
      if (delta > 0) {
        return { failure: createForwardNotSupportedFailure(from) }
      }
      if (delta === 0) {
        return { noop: true }
      }
      return { target: resolveBackNavigationTarget(-delta, from, to => resolve(to), readLocation) }
    },
    go: (delta, to, from) => executeNavigationMethod(
      nativeRouter.navigateBack as (options: Record<string, any>) => unknown,
      { delta: -delta },
      to,
      from,
    ),
  }
}

/**
 * 每个 router 初始化一次驱动；把应用钩子编译成标准适配器。
 *
 * 钩子缺省时完全沿用原生行为；应用只需覆盖关心的方法，
 * 未覆盖的部分可用 `defaultHistory` 委托回原生页面栈。
 */
export function resolveHistory(history: RouterHistory, context: RouterHistoryContextBase): RouterHistoryAdapter {
  // 最终位置读取器在 hooks.create 之后才确定；适配器通过惰性转发保持不可变。
  let readLocation: RouterHistoryAdapter['readLocation'] = resolvePageRoute
  const defaultHistory = createMiniProgramHistoryAdapter(context, (page, query) => readLocation(page, query))
  const hooks: RouterHistoryHooks = history.create({ ...context, defaultHistory })

  // 带显式原生 query 的同步让位原生值；其余读取交给自定义钩子，框架直接采用其结果。
  const wrappedReadLocation: RouterHistoryAdapter['readLocation'] = (page, query) => {
    const location = defaultHistory.readLocation(page, query)
    if (query !== undefined || !hooks.readLocation) {
      return location
    }
    return hooks.readLocation(location) ?? location
  }
  readLocation = wrappedReadLocation

  // 已解析位置的自定义读取：不经过默认页面投影，避免把 RouteLocation 当宿主 page。
  const readResolvedLocation: RouterHistoryAdapter['readResolvedLocation'] = location => hooks.readLocation?.(location) ?? location

  return {
    check: hooks.check ?? defaultHistory.check,
    push: hooks.push ?? defaultHistory.push,
    replace: hooks.replace ?? defaultHistory.replace,
    resolveGo: hooks.resolveGo ?? defaultHistory.resolveGo,
    go: hooks.go ?? defaultHistory.go,
    readLocation: wrappedReadLocation,
    readResolvedLocation,
    resetLocation: hooks.resetLocation ?? defaultHistory.resetLocation,
  }
}
