import type {
  NamedRouteLookup,
  RouteResolveCodec,
} from '../routerInternal/shared'
import type { NavigationRunResult } from './navigationResult'
import type {
  NavigationFailure,
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import { snapshotRouteLocation } from '../routerInternal/shared'
import {
  createNavigationFailure,
  executeNavigationMethod,
  isNavigationFailure,
  runNavigationGuards,
} from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import { navigateWithTarget } from './navigationTarget'
import { createForwardNotSupportedFailure } from './navigationTargetHelpers'
import { NavigationFailureType } from './types'

interface CreateNavigationApiOptions {
  nativeRouter: Record<string, any>
  route: Readonly<RouteLocationNormalizedLoaded>
  routeResolveCodec: RouteResolveCodec
  namedRouteLookup: NamedRouteLookup
  beforeEachGuards: ReadonlySet<NavigationGuard>
  beforeResolveGuards: ReadonlySet<NavigationGuard>
  maxRedirects: number
  tabBarPathSet: ReadonlySet<string>
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
  settleNavigationResult: (result: NavigationRunResult) => Promise<void | NavigationFailure>
}

export function createNavigationApi(options: CreateNavigationApiOptions) {
  const {
    nativeRouter,
    route,
    routeResolveCodec,
    namedRouteLookup,
    beforeEachGuards,
    beforeResolveGuards,
    maxRedirects,
    tabBarPathSet,
    resolveWithCodec,
    settleNavigationResult,
  } = options

  async function push(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    let target: RouteLocationNormalizedLoaded
    try {
      target = resolveWithCodec(to, from.path)
    }
    catch (error) {
      return settleNavigationResult(
        createNavigationRunResult(
          'push',
          from,
          undefined,
          createNavigationFailure(NavigationFailureType.unknown, undefined, from, error),
        ),
      )
    }
    const result = await navigateWithTarget({
      mode: 'push',
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
    })
    return settleNavigationResult(result)
  }

  async function replace(to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    let target: RouteLocationNormalizedLoaded
    try {
      target = resolveWithCodec(to, from.path)
    }
    catch (error) {
      return settleNavigationResult(
        createNavigationRunResult(
          'replace',
          from,
          undefined,
          createNavigationFailure(NavigationFailureType.unknown, undefined, from, error),
        ),
      )
    }
    const result = await navigateWithTarget({
      mode: 'replace',
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
    })
    return settleNavigationResult(result)
  }

  async function back(delta = 1): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(route)
    const beforeEachResult = await runNavigationGuards(beforeEachGuards, {
      mode: 'back',
      from,
      nativeRouter: nativeRouter as any,
    }, resolveWithCodec)
    if (beforeEachResult.status === 'failure') {
      return settleNavigationResult(createNavigationRunResult('back', from, undefined, beforeEachResult.failure))
    }
    if (beforeEachResult.status === 'redirect') {
      return settleNavigationResult(
        createNavigationRunResult(
          'back',
          from,
          undefined,
          createNavigationFailure(
            NavigationFailureType.aborted,
            undefined,
            from,
            'Redirect is not supported in back navigation guards',
          ),
        ),
      )
    }

    const beforeResolveResult = await runNavigationGuards(beforeResolveGuards, {
      mode: 'back',
      from,
      nativeRouter: nativeRouter as any,
    }, resolveWithCodec)
    if (beforeResolveResult.status === 'failure') {
      return settleNavigationResult(createNavigationRunResult('back', from, undefined, beforeResolveResult.failure))
    }
    if (beforeResolveResult.status === 'redirect') {
      return settleNavigationResult(
        createNavigationRunResult(
          'back',
          from,
          undefined,
          createNavigationFailure(
            NavigationFailureType.aborted,
            undefined,
            from,
            'Redirect is not supported in back navigation guards',
          ),
        ),
      )
    }

    const result = await executeNavigationMethod(
      nativeRouter.navigateBack as (options: Record<string, any>) => unknown,
      { delta },
      undefined,
      from,
    )
    const runResult = isNavigationFailure(result)
      ? createNavigationRunResult('back', from, undefined, result)
      : createNavigationRunResult('back', from)
    return settleNavigationResult(runResult)
  }

  async function go(delta: number): Promise<void | NavigationFailure> {
    if (delta < 0) {
      return back(Math.abs(delta))
    }
    if (delta === 0) {
      return undefined
    }
    const from = snapshotRouteLocation(route)
    return settleNavigationResult(
      createNavigationRunResult(
        'back',
        from,
        undefined,
        createForwardNotSupportedFailure(from),
      ),
    )
  }

  async function forward(): Promise<void | NavigationFailure> {
    return go(1)
  }

  return {
    push,
    replace,
    back,
    go,
    forward,
  }
}
