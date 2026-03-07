import type { NavigationFailure, RouteLocationNormalizedLoaded, RouteLocationRaw, RouteRecordRedirect } from './types'
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

export function applyRedirectedFrom(
  redirectedTarget: RouteLocationNormalizedLoaded,
  currentTarget: RouteLocationNormalizedLoaded,
) {
  const redirectedFrom = currentTarget.redirectedFrom
    ? cloneRouteLocationRedirectedFrom(currentTarget.redirectedFrom)
    : createRedirectedFromSnapshot(currentTarget)
  redirectedTarget.redirectedFrom = redirectedFrom
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
      target: resolveWithCodec(redirectResult.to, to.path),
      replace: redirectResult.replace,
    }
  }

  return {
    target: resolveWithCodec(redirectResult, to.path),
    replace: true,
  }
}
