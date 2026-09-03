import type { MiniProgramPageLike } from '../routerInternal/shared'
import type { InitialNavigationMode, LocationQueryRaw, NavigationFailure } from './types'
import { WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER } from '@weapp-core/constants'
import { queueMicrotaskPolyfill } from '@wevu/web-apis'
import { getActiveRouter } from './instance'

export const DEFAULT_INITIAL_NAVIGATION_TIMEOUT = 10_000

export type InitialNavigationStatus = 'idle' | 'running' | 'allowed' | 'aborted' | 'timed-out' | 'cancelled'

interface InitialNavigationRunnerRegistration {
  runner: InitialNavigationRunner
  mode: InitialNavigationMode
  timeoutMs: number
}

export type InitialNavigationRunner = (
  page: MiniProgramPageLike,
  query?: LocationQueryRaw,
  isActive?: () => boolean,
) => Promise<void | NavigationFailure>

interface InitialNavigationController {
  readonly promise: Promise<boolean>
  readonly blocking: boolean
  readonly status: () => InitialNavigationStatus
  subscribe: (callback: (shouldMount: boolean) => void) => () => void
  start: (query?: LocationQueryRaw) => void
  cancel: () => void
}

const initialNavigationRunners = new WeakMap<object, InitialNavigationRunnerRegistration>()
const initialNavigationControllers = new WeakMap<object, InitialNavigationController>()

function normalizeTimeout(timeoutMs: number) {
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.max(1, Math.trunc(timeoutMs))
    : DEFAULT_INITIAL_NAVIGATION_TIMEOUT
}

function snapshotPage(instance: MiniProgramPageLike): MiniProgramPageLike {
  return {
    route: typeof instance.route === 'string' ? instance.route : undefined,
    __route__: typeof instance.__route__ === 'string' ? instance.__route__ : undefined,
    options: instance.options && typeof instance.options === 'object'
      ? { ...instance.options }
      : undefined,
  }
}

function snapshotQuery(query: LocationQueryRaw | undefined): LocationQueryRaw | undefined {
  if (!query || typeof query !== 'object') {
    return undefined
  }
  const snapshot: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    snapshot[key] = Array.isArray(value) ? [...value] : value
  }
  return snapshot
}

export function registerInitialNavigationRunner(
  router: object,
  runner: InitialNavigationRunner,
  timeoutMs = DEFAULT_INITIAL_NAVIGATION_TIMEOUT,
  mode: InitialNavigationMode = 'blocking',
) {
  initialNavigationRunners.set(router, {
    runner,
    mode,
    timeoutMs: normalizeTimeout(timeoutMs),
  })
}

export function getInitialNavigationRunner(): InitialNavigationRunner | undefined {
  const router = getActiveRouter()
  return router ? initialNavigationRunners.get(router)?.runner : undefined
}

export function getInitialNavigationTimeout() {
  const router = getActiveRouter()
  return router ? initialNavigationRunners.get(router)?.timeoutMs ?? DEFAULT_INITIAL_NAVIGATION_TIMEOUT : DEFAULT_INITIAL_NAVIGATION_TIMEOUT
}

export function getInitialNavigationMode(): InitialNavigationMode {
  const router = getActiveRouter()
  return router ? initialNavigationRunners.get(router)?.mode ?? 'eager' : 'eager'
}

function isNavigationFailureResult(result: void | NavigationFailure): result is NavigationFailure {
  return Boolean(result && typeof result === 'object' && (result as NavigationFailure).__wevuNavigationFailure)
}

export function getInitialNavigationPromise(instance: MiniProgramPageLike) {
  return initialNavigationControllers.get(instance as object)?.promise
}

export function getInitialNavigationStatus(instance: MiniProgramPageLike) {
  return initialNavigationControllers.get(instance as object)?.status()
}

export function ensureInitialNavigation(
  instance: MiniProgramPageLike,
  query?: LocationQueryRaw,
  options: { start?: boolean, onComplete?: (shouldMount: boolean) => void } = {},
) {
  const existing = initialNavigationControllers.get(instance as object)
  if (existing) {
    if (options.onComplete && existing.blocking) {
      existing.subscribe(options.onComplete)
    }
    if (options.start !== false) {
      existing.start(query)
    }
    return existing.blocking ? existing.promise : undefined
  }

  const router = getActiveRouter()
  const registration = router ? initialNavigationRunners.get(router) : undefined
  let pendingRunner = registration?.runner
  if (!pendingRunner) {
    return undefined
  }
  const blocking = registration?.mode === 'blocking'

  let page: MiniProgramPageLike | undefined = snapshotPage(instance)
  let initialQuery = snapshotQuery(query)
  let currentStatus: InitialNavigationStatus = 'idle'
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutMs = getInitialNavigationTimeout()
  let resolveNavigation!: (shouldMount: boolean) => void
  const completionCallbacks = new Set<{ callback: (shouldMount: boolean) => void, active: boolean }>()
  const promise = new Promise<boolean>((resolve) => {
    resolveNavigation = resolve
  })

  const settle = (status: Exclude<InitialNavigationStatus, 'idle' | 'running'>, shouldMount: boolean) => {
    if (currentStatus !== 'idle' && currentStatus !== 'running') {
      return
    }
    currentStatus = status
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle)
      timeoutHandle = undefined
    }
    const callbacks = [...completionCallbacks]
    completionCallbacks.clear()
    pendingRunner = undefined
    page = undefined
    initialQuery = undefined
    resolveNavigation(shouldMount)
    queueMicrotaskPolyfill(() => {
      if (currentStatus !== 'allowed' && currentStatus !== 'timed-out') {
        return
      }
      for (const entry of callbacks) {
        if (entry.active) {
          entry.callback(shouldMount)
          entry.active = false
        }
      }
    })
  }

  const controller: InitialNavigationController = {
    promise,
    blocking,
    status: () => currentStatus,
    subscribe(callback) {
      const entry = { callback, active: true }
      if (currentStatus !== 'idle' && currentStatus !== 'running') {
        queueMicrotaskPolyfill(() => {
          if (entry.active && (currentStatus === 'allowed' || currentStatus === 'timed-out')) {
            callback(currentStatus === 'allowed' || currentStatus === 'timed-out')
            entry.active = false
          }
        })
      }
      else {
        completionCallbacks.add(entry)
      }
      return () => {
        entry.active = false
        completionCallbacks.delete(entry)
      }
    },
    start(startQuery?: LocationQueryRaw) {
      if (currentStatus !== 'idle') {
        return
      }
      currentStatus = 'running'
      if (blocking) {
        timeoutHandle = setTimeout(() => {
          if (currentStatus !== 'running') {
            return
          }
          // 超时是可恢复的运行时诊断，保留稳定 marker 供宿主和 E2E 观测。
          // eslint-disable-next-line no-console
          console.warn(`${WEVU_INITIAL_NAVIGATION_TIMEOUT_MARKER} initial navigation exceeded ${timeoutMs}ms; mounting page`, page?.route ?? page?.__route__ ?? '')
          settle('timed-out', true)
        }, timeoutMs)
      }
      const runnerPage = page
      const runnerQuery = snapshotQuery(startQuery ?? initialQuery)
      const runner = pendingRunner
      pendingRunner = undefined
      if (!runner || !runnerPage) {
        settle('aborted', false)
        return
      }
      void runner(runnerPage, runnerQuery, () => currentStatus === 'running').then((result) => {
        const failed = isNavigationFailureResult(result)
        settle(failed ? 'aborted' : 'allowed', !failed)
      }, () => {
        settle('aborted', false)
      })
    },
    cancel() {
      settle('cancelled', false)
    },
  }

  initialNavigationControllers.set(instance as object, controller)
  if (options.onComplete && blocking) {
    controller.subscribe(options.onComplete)
  }
  if (options.start !== false) {
    controller.start(query)
  }
  return blocking ? promise : undefined
}

export function cancelInitialNavigation(instance: MiniProgramPageLike) {
  initialNavigationControllers.get(instance as object)?.cancel()
}
