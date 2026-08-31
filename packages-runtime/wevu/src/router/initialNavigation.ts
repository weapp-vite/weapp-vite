import type { MiniProgramPageLike } from '../routerInternal/shared'
import type { NavigationFailure } from './types'
import { getActiveRouter } from './instance'

export type InitialNavigationRunner = (
  page: MiniProgramPageLike,
  query?: Record<string, unknown>,
) => Promise<void | NavigationFailure>

const initialNavigationRunners = new WeakMap<object, InitialNavigationRunner>()

export function registerInitialNavigationRunner(
  router: object,
  runner: InitialNavigationRunner,
) {
  initialNavigationRunners.set(router, runner)
}

export function getInitialNavigationRunner(): InitialNavigationRunner | undefined {
  const router = getActiveRouter()
  return router ? initialNavigationRunners.get(router) : undefined
}
