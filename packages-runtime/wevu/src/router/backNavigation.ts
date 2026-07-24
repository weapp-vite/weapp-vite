import type { SetupContextRouter } from '../runtime/types/props'
import type { NavigationRunResult } from './navigationResult'
import type {
  NavigationGuard,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import { resolvePageRoute } from '../routerInternal/shared'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import { createNavigationFailure, runNavigationGuards } from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import { NavigationFailureType } from './types'

interface RunBackNavigationGuardsOptions {
  target?: RouteLocationNormalizedLoaded
  from: RouteLocationNormalizedLoaded
  nativeRouter: SetupContextRouter
  beforeEachGuards: ReadonlySet<NavigationGuard>
  beforeResolveGuards: ReadonlySet<NavigationGuard>
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
}

export function resolveBackNavigationTarget(
  delta: number,
  from: RouteLocationNormalizedLoaded,
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): RouteLocationNormalizedLoaded | undefined {
  const pages = getCurrentMiniProgramPages()
  const targetPage = pages[pages.length - 1 - delta]
  if (!targetPage) {
    return undefined
  }
  const target = resolvePageRoute(targetPage)
  return resolveWithCodec(target.fullPath, from.path)
}

export async function runBackNavigationGuards(
  options: RunBackNavigationGuardsOptions,
): Promise<NavigationRunResult> {
  const {
    target,
    from,
    nativeRouter,
    beforeEachGuards,
    beforeResolveGuards,
    resolveWithCodec,
  } = options
  const guardContext = {
    mode: 'back' as const,
    to: target,
    from,
    nativeRouter,
  }

  for (const guards of [beforeEachGuards, beforeResolveGuards]) {
    const guardResult = await runNavigationGuards(guards, guardContext, resolveWithCodec)
    if (guardResult.status === 'failure') {
      return createNavigationRunResult('back', from, target, guardResult.failure)
    }
    if (guardResult.status === 'redirect') {
      return createNavigationRunResult(
        'back',
        from,
        target,
        createNavigationFailure(
          NavigationFailureType.aborted,
          target,
          from,
          'Redirect is not supported in back navigation guards',
        ),
      )
    }
  }

  return createNavigationRunResult('back', from, target)
}
