import type { SetupContextRouter } from '../runtime/types/props'
import type {
  NavigationAfterEach,
  NavigationErrorHandler,
  NavigationFailure,
  NavigationMode,
  RouteLocationNormalizedLoaded,
} from './types'
import { runAfterEachHooks, runNavigationErrorHooks, shouldEmitNavigationError } from './navigationCore'

export interface NavigationRunResult {
  mode: NavigationMode
  from: RouteLocationNormalizedLoaded
  to?: RouteLocationNormalizedLoaded
  failure?: NavigationFailure
}

export function createNavigationRunResult(
  mode: NavigationMode,
  from: RouteLocationNormalizedLoaded,
  to?: RouteLocationNormalizedLoaded,
  failure?: NavigationFailure,
): NavigationRunResult {
  return {
    mode,
    from,
    to,
    failure,
  }
}

export function createNavigationResultController(options: {
  afterEachHooks: ReadonlySet<NavigationAfterEach>
  errorHandlers: ReadonlySet<NavigationErrorHandler>
  nativeRouter: SetupContextRouter
  rejectOnError: boolean
}) {
  const {
    afterEachHooks,
    errorHandlers,
    nativeRouter,
    rejectOnError,
  } = options

  async function emitNavigationAfterEach(result: NavigationRunResult): Promise<void> {
    await runAfterEachHooks(afterEachHooks, {
      mode: result.mode,
      to: result.to,
      from: result.from,
      nativeRouter,
      failure: result.failure,
    })

    if (result.failure && shouldEmitNavigationError(result.failure)) {
      await runNavigationErrorHooks(
        errorHandlers,
        result.failure.cause ?? result.failure,
        {
          mode: result.mode,
          to: result.to,
          from: result.from,
          nativeRouter,
          failure: result.failure,
        },
      )
    }
  }

  function shouldRejectNavigationFailure(failure: NavigationFailure): boolean {
    return rejectOnError && shouldEmitNavigationError(failure)
  }

  async function settleNavigationResult(result: NavigationRunResult): Promise<void | NavigationFailure> {
    await emitNavigationAfterEach(result)
    if (result.failure && shouldRejectNavigationFailure(result.failure)) {
      throw result.failure
    }
    return result.failure
  }

  return {
    settleNavigationResult,
  }
}
