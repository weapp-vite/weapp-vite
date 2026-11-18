import type { NavigationFailure, NavigationMode, RouteLocationNormalizedLoaded, RouteLocationRaw, RouteRecordRedirect } from './types'
import { cloneRouteLocationRedirectedFrom, createRedirectedFromSnapshot } from '../routerInternal/shared'
import { createNavigationFailure, isNavigationRedirectCandidate } from './navigationCore'
import { NavigationFailureType } from './types'

export function createDuplicatedFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
  return createNavigationFailure(
    NavigationFailureType.duplicated,
    target,
    from,
    'Avoided redundant navigation to current location',
  )
}

export function createTabBarQueryFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
  return createNavigationFailure(
    NavigationFailureType.aborted,
    target,
    from,
    'switchTab does not support query parameters',
  )
}

export function createTooManyRedirectsFailure(
  target: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  maxRedirects: number,
): NavigationFailure {
  return createNavigationFailure(
    NavigationFailureType.aborted,
    target,
    from,
    `Navigation redirected more than ${maxRedirects} times`,
  )
}

export function createHashOnlyNavigationFailure(target: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded): NavigationFailure {
  return createNavigationFailure(
    NavigationFailureType.aborted,
    target,
    from,
    'Hash-only navigation is not supported in mini-program router',
  )
}

export function createForwardNotSupportedFailure(from: RouteLocationNormalizedLoaded): NavigationFailure {
  return createNavigationFailure(
    NavigationFailureType.aborted,
    undefined,
    from,
    'Forward navigation is not supported in mini-program router',
  )
}

export async function resolveRouteRecordRedirect(
  redirect: RouteRecordRedirect,
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded,
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): Promise<{ target: RouteLocationNormalizedLoaded, replace?: boolean }> {
  const redirectResult = typeof redirect === 'function'
    ? await redirect(to, from)
    : redirect

  if (isNavigationRedirectCandidate(redirectResult)) {
    return {
      // 相对路径以「导航起点」为基准：与守卫改道、驱动级改道、router.resolve 同源。
      target: resolveWithCodec(redirectResult.to, from.path),
      replace: redirectResult.replace,
    }
  }

  return {
    target: resolveWithCodec(redirectResult, from.path),
    replace: true,
  }
}

/** 重定向只会产生前向导航模式，不会退化为返回。 */
export type RedirectMode = Exclude<NavigationMode, 'back'>

/**
 * 重定向模式解析。
 *
 * `replace` 为三态：`true` 替换当前记录、`false` 压入新记录、`undefined` 沿用默认模式。
 * 守卫链沿用当前模式；路由记录重定向默认替换当前记录。
 */
export function resolveRedirectMode(
  replace: boolean | undefined,
  defaultMode: RedirectMode,
): RedirectMode {
  if (replace === true) {
    return 'replace'
  }
  if (replace === false) {
    return 'push'
  }
  return defaultMode
}

/** 写入重定向来源快照：目标位置记录它是从哪个位置跳转而来。 */
export function applyRedirectedFrom(
  redirectedTarget: RouteLocationNormalizedLoaded,
  currentTarget: RouteLocationNormalizedLoaded,
) {
  const redirectedFrom = currentTarget.redirectedFrom
    ? cloneRouteLocationRedirectedFrom(currentTarget.redirectedFrom)
    : createRedirectedFromSnapshot(currentTarget)
  redirectedTarget.redirectedFrom = redirectedFrom
}

/** 重定向转移结果。 */
export interface RedirectTransition {
  readonly target: RouteLocationNormalizedLoaded
  readonly mode: RedirectMode
}

/**
 * 应用一次重定向转移。
 *
 * 目标位置与导航模式都没有变化时不构成转移，返回 `undefined`，调用方按原流程继续；
 * 构成转移时写入 `redirectedFrom` 并返回新的目标与模式。
 */
export function applyRedirectTransition(options: {
  redirectedTarget: RouteLocationNormalizedLoaded
  currentTarget: RouteLocationNormalizedLoaded
  currentMode: RedirectMode
  nextMode: RedirectMode
}): RedirectTransition | undefined {
  if (options.redirectedTarget.fullPath === options.currentTarget.fullPath
    && options.nextMode === options.currentMode) {
    return undefined
  }
  applyRedirectedFrom(options.redirectedTarget, options.currentTarget)
  return {
    target: options.redirectedTarget,
    mode: options.nextMode,
  }
}

/** 单次导航的重定向计量：累计次数并判定是否超过上限。 */
export interface RedirectCounter {
  /** 记一次重定向；返回 `false` 表示已超过上限。 */
  increase: () => boolean
  /** 当前累计的重定向次数。 */
  readonly count: number
}

/** 创建重定向计量器。 */
export function createRedirectCounter(maxRedirects: number): RedirectCounter {
  let count = 0
  return {
    increase: () => {
      count += 1
      return count <= maxRedirects
    },
    get count() {
      return count
    },
  }
}
