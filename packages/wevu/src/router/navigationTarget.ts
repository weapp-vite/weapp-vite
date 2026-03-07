import type {
  NamedRouteLookup,
  RouteResolveCodec,
} from '../routerInternal/shared'
import type { NavigationRunResult } from './navigationResult'
import type {
  NavigationGuard,
  NavigationMode,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import {
  createAbsoluteRoutePath,
  createNativeRouteUrl,
  hasLocationQuery,
  resolveMatchedRouteRecord,
} from '../routerInternal/shared'
import {
  createNavigationFailure,
  executeNavigationMethod,
  isNavigationFailure,
  runNavigationGuards,
} from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import {
  applyRedirectedFrom,
  createDuplicatedFailure,
  createHashOnlyNavigationFailure,
  createTabBarQueryFailure,
  createTooManyRedirectsFailure,
  resolveRouteRecordRedirect,
} from './navigationTargetHelpers'
import { NavigationFailureType } from './types'

interface NavigateWithTargetOptions {
  mode: Exclude<NavigationMode, 'back'>
  target: RouteLocationNormalizedLoaded
  from: RouteLocationNormalizedLoaded
  nativeRouter: Record<string, any>
  routeResolveCodec: RouteResolveCodec
  namedRouteLookup: NamedRouteLookup
  beforeEachGuards: ReadonlySet<NavigationGuard>
  beforeResolveGuards: ReadonlySet<NavigationGuard>
  maxRedirects: number
  tabBarPathSet: ReadonlySet<string>
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
}

export async function navigateWithTarget(options: NavigateWithTargetOptions): Promise<NavigationRunResult> {
  const {
    mode,
    target,
    from,
    nativeRouter,
    routeResolveCodec,
    namedRouteLookup,
    beforeEachGuards,
    beforeResolveGuards,
    maxRedirects,
    tabBarPathSet,
    resolveWithCodec,
  } = options
  let currentTarget = target
  let currentMode: Exclude<NavigationMode, 'back'> = mode
  let redirectCount = 0

  while (true) {
    const tabBarTarget = tabBarPathSet.has(currentTarget.path)
    const sameNativeLocation = createNativeRouteUrl(currentTarget, routeResolveCodec.stringifyQuery)
      === createNativeRouteUrl(from, routeResolveCodec.stringifyQuery)
    if (sameNativeLocation && currentTarget.hash !== from.hash) {
      return createNavigationRunResult(currentMode, from, currentTarget, createHashOnlyNavigationFailure(currentTarget, from))
    }

    const duplicated = tabBarTarget
      ? currentTarget.path === from.path
      : currentTarget.fullPath === from.fullPath
    if (duplicated) {
      return createNavigationRunResult(currentMode, from, currentTarget, createDuplicatedFailure(currentTarget, from))
    }

    if (tabBarTarget && hasLocationQuery(currentTarget.query)) {
      return createNavigationRunResult(currentMode, from, currentTarget, createTabBarQueryFailure(currentTarget, from))
    }

    const beforeEachResult = await runNavigationGuards(beforeEachGuards, {
      mode: currentMode,
      to: currentTarget,
      from,
      nativeRouter: nativeRouter as any,
    }, resolveWithCodec)

    if (beforeEachResult.status === 'failure') {
      return createNavigationRunResult(currentMode, from, currentTarget, beforeEachResult.failure)
    }
    if (beforeEachResult.status === 'redirect') {
      const redirectedTarget = beforeEachResult.target
      const redirectedMode = beforeEachResult.replace === true
        ? 'replace'
        : beforeEachResult.replace === false
          ? 'push'
          : currentMode
      if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
        applyRedirectedFrom(redirectedTarget, currentTarget)
        currentTarget = redirectedTarget
        currentMode = redirectedMode
        redirectCount += 1
        if (redirectCount > maxRedirects) {
          return createNavigationRunResult(
            currentMode,
            from,
            currentTarget,
            createTooManyRedirectsFailure(currentTarget, from, maxRedirects),
          )
        }
        continue
      }
    }

    const matchedRouteResult = resolveMatchedRouteRecord(currentTarget, namedRouteLookup)
    const matchedRouteRecords = matchedRouteResult?.matchedRecords ?? []
    let redirectedByRouteRecord = false
    for (const matchedRouteRecord of matchedRouteRecords) {
      if (matchedRouteRecord.redirect === undefined) {
        continue
      }
      let redirectedByRecord: { target: RouteLocationNormalizedLoaded, replace?: boolean }
      try {
        redirectedByRecord = await resolveRouteRecordRedirect(
          matchedRouteRecord.redirect,
          currentTarget,
          from,
          resolveWithCodec,
        )
      }
      catch (error) {
        return createNavigationRunResult(
          currentMode,
          from,
          currentTarget,
          createNavigationFailure(NavigationFailureType.aborted, currentTarget, from, error),
        )
      }

      const redirectedMode = redirectedByRecord.replace === false ? 'push' : 'replace'
      const redirectedTarget = redirectedByRecord.target
      if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
        applyRedirectedFrom(redirectedTarget, currentTarget)
        currentTarget = redirectedTarget
        currentMode = redirectedMode
        redirectCount += 1
        if (redirectCount > maxRedirects) {
          return createNavigationRunResult(
            currentMode,
            from,
            currentTarget,
            createTooManyRedirectsFailure(currentTarget, from, maxRedirects),
          )
        }
        redirectedByRouteRecord = true
        break
      }
    }
    if (redirectedByRouteRecord) {
      continue
    }

    let redirectedByBeforeEnter = false
    for (const matchedRouteRecord of matchedRouteRecords) {
      if (matchedRouteRecord.beforeEnterGuards.length === 0) {
        continue
      }
      const beforeEnterResult = await runNavigationGuards(new Set(matchedRouteRecord.beforeEnterGuards), {
        mode: currentMode,
        to: currentTarget,
        from,
        nativeRouter: nativeRouter as any,
      }, resolveWithCodec)

      if (beforeEnterResult.status === 'failure') {
        return createNavigationRunResult(currentMode, from, currentTarget, beforeEnterResult.failure)
      }
      if (beforeEnterResult.status === 'redirect') {
        const redirectedTarget = beforeEnterResult.target
        const redirectedMode = beforeEnterResult.replace === true
          ? 'replace'
          : beforeEnterResult.replace === false
            ? 'push'
            : currentMode
        if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
          applyRedirectedFrom(redirectedTarget, currentTarget)
          currentTarget = redirectedTarget
          currentMode = redirectedMode
          redirectCount += 1
          if (redirectCount > maxRedirects) {
            return createNavigationRunResult(
              currentMode,
              from,
              currentTarget,
              createTooManyRedirectsFailure(currentTarget, from, maxRedirects),
            )
          }
          redirectedByBeforeEnter = true
          break
        }
      }
    }
    if (redirectedByBeforeEnter) {
      continue
    }

    const beforeResolveResult = await runNavigationGuards(beforeResolveGuards, {
      mode: currentMode,
      to: currentTarget,
      from,
      nativeRouter: nativeRouter as any,
    }, resolveWithCodec)

    if (beforeResolveResult.status === 'failure') {
      return createNavigationRunResult(currentMode, from, currentTarget, beforeResolveResult.failure)
    }
    if (beforeResolveResult.status === 'redirect') {
      const redirectedTarget = beforeResolveResult.target
      const redirectedMode = beforeResolveResult.replace === true
        ? 'replace'
        : beforeResolveResult.replace === false
          ? 'push'
          : currentMode
      if (redirectedTarget.fullPath !== currentTarget.fullPath || redirectedMode !== currentMode) {
        applyRedirectedFrom(redirectedTarget, currentTarget)
        currentTarget = redirectedTarget
        currentMode = redirectedMode
        redirectCount += 1
        if (redirectCount > maxRedirects) {
          return createNavigationRunResult(
            currentMode,
            from,
            currentTarget,
            createTooManyRedirectsFailure(currentTarget, from, maxRedirects),
          )
        }
        continue
      }
    }

    if (tabBarTarget) {
      const result = await executeNavigationMethod(
        nativeRouter.switchTab as (options: Record<string, any>) => unknown,
        { url: createAbsoluteRoutePath(currentTarget.path) },
        currentTarget,
        from,
      )
      if (isNavigationFailure(result)) {
        return createNavigationRunResult(currentMode, from, currentTarget, result)
      }
      return createNavigationRunResult(currentMode, from, currentTarget)
    }

    const nativeMethod = currentMode === 'push'
      ? nativeRouter.navigateTo
      : nativeRouter.redirectTo
    const result = await executeNavigationMethod(
      nativeMethod as (options: Record<string, any>) => unknown,
      { url: createNativeRouteUrl(currentTarget, routeResolveCodec.stringifyQuery) },
      currentTarget,
      from,
    )
    if (isNavigationFailure(result)) {
      return createNavigationRunResult(currentMode, from, currentTarget, result)
    }
    return createNavigationRunResult(currentMode, from, currentTarget)
  }
}
