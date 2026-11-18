import type { RouterHistoryAdapter } from './history'
import type { BackNavigationContext } from './navigationContext'
import type { NavigationRunResult } from './navigationResult'
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import { getCurrentMiniProgramPages } from '../runtime/platform'
import { createNavigationFailure, runNavigationGuards } from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import { NavigationFailureType } from './types'

export function resolveBackNavigationTarget(
  delta: number,
  from: RouteLocationNormalizedLoaded,
  resolveWithCodec: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
  readLocation: RouterHistoryAdapter['readLocation'],
): RouteLocationNormalizedLoaded | undefined {
  const pages = getCurrentMiniProgramPages()
  const targetPage = pages[pages.length - 1 - delta]
  if (!targetPage) {
    return undefined
  }
  const target = readLocation(targetPage)
  return resolveWithCodec(target.fullPath, from.path)
}

export async function runBackNavigationGuards(
  context: BackNavigationContext,
  options: {
    target?: RouteLocationNormalizedLoaded
    from: RouteLocationNormalizedLoaded
  },
): Promise<NavigationRunResult> {
  const { target, from } = options
  const {
    nativeRouter,
    beforeEachGuards,
    beforeResolveGuards,
    resolveWithCodec,
    readGuardTarget,
  } = context
  const guardContext = {
    mode: 'back' as const,
    to: target && readGuardTarget(target),
    from: readGuardTarget(from),
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
