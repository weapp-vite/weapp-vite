import type {
  NavigationAfterEach,
  NavigationAfterEachContext,
  NavigationErrorContext,
  NavigationErrorHandler,
  NavigationFailure,
  NavigationFailureTypeValue,
  NavigationGuard,
  NavigationGuardContext,
  NavigationRedirect,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import { NavigationFailureType } from './types'

function normalizeNavigationErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).errMsg
    if (typeof message === 'string') {
      return message
    }
    if (error instanceof Error) {
      return error.message
    }
  }
  return ''
}

function resolveNavigationFailureType(error: unknown): NavigationFailureTypeValue {
  const normalizedMessage = normalizeNavigationErrorMessage(error).toLowerCase()
  if (/already|same|duplicat|重复/.test(normalizedMessage)) {
    return NavigationFailureType.duplicated
  }
  if (/cancel|取消/.test(normalizedMessage)) {
    return NavigationFailureType.cancelled
  }
  if (/abort|interrupt|中断/.test(normalizedMessage)) {
    return NavigationFailureType.aborted
  }
  return NavigationFailureType.unknown
}

export function createNavigationFailure(
  type: NavigationFailureTypeValue,
  to?: RouteLocationNormalizedLoaded,
  from?: RouteLocationNormalizedLoaded,
  cause?: unknown,
): NavigationFailure {
  const message = normalizeNavigationErrorMessage(cause) || 'Navigation failed'
  const error = new Error(message) as NavigationFailure
  ;(error as { __wevuNavigationFailure: true }).__wevuNavigationFailure = true
  ;(error as { type: NavigationFailureTypeValue }).type = type
  ;(error as { to?: RouteLocationNormalizedLoaded }).to = to
  ;(error as { from?: RouteLocationNormalizedLoaded }).from = from
  ;(error as { cause?: unknown }).cause = cause
  return error
}

export function isNavigationFailure(error: unknown, type?: NavigationFailureTypeValue): error is NavigationFailure {
  if (!error || typeof error !== 'object') {
    return false
  }
  const navigationError = error as Partial<NavigationFailure>
  if (navigationError.__wevuNavigationFailure !== true) {
    return false
  }
  if (type === undefined) {
    return true
  }
  return navigationError.type === type
}

interface GuardPipelineContinue {
  status: 'continue'
}

interface GuardPipelineFailure {
  status: 'failure'
  failure: NavigationFailure
}

interface GuardPipelineRedirect {
  status: 'redirect'
  target: RouteLocationNormalizedLoaded
  replace?: boolean
}

export type GuardPipelineResult = GuardPipelineContinue | GuardPipelineFailure | GuardPipelineRedirect

export function isNavigationRedirectCandidate(value: unknown): value is NavigationRedirect {
  if (!value || typeof value !== 'object') {
    return false
  }
  return 'to' in (value as Record<string, unknown>)
}

function isRouteLocationRawCandidate(value: unknown): value is RouteLocationRaw {
  if (typeof value === 'string') {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return 'path' in candidate
    || 'fullPath' in candidate
    || 'query' in candidate
    || 'hash' in candidate
    || 'name' in candidate
    || 'params' in candidate
}

export async function runNavigationGuards(
  guards: ReadonlySet<NavigationGuard>,
  context: NavigationGuardContext,
  resolveRoute: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): Promise<GuardPipelineResult> {
  for (const guard of guards) {
    try {
      const result = await guard(context.to, context.from, context)
      if (isNavigationFailure(result)) {
        return {
          status: 'failure',
          failure: result,
        }
      }
      if (result === false) {
        return {
          status: 'failure',
          failure: createNavigationFailure(
            NavigationFailureType.aborted,
            context.to,
            context.from,
            'Navigation aborted by guard',
          ),
        }
      }
      if (isNavigationRedirectCandidate(result)) {
        if (!context.to) {
          return {
            status: 'failure',
            failure: createNavigationFailure(
              NavigationFailureType.aborted,
              context.to,
              context.from,
              'Redirect is not supported in back navigation guards',
            ),
          }
        }
        return {
          status: 'redirect',
          target: resolveRoute(result.to, context.to.path),
          replace: result.replace,
        }
      }
      if (isRouteLocationRawCandidate(result)) {
        if (!context.to) {
          return {
            status: 'failure',
            failure: createNavigationFailure(
              NavigationFailureType.aborted,
              context.to,
              context.from,
              'Redirect is not supported in back navigation guards',
            ),
          }
        }
        return {
          status: 'redirect',
          target: resolveRoute(result, context.to.path),
        }
      }
    }
    catch (error) {
      return {
        status: 'failure',
        failure: createNavigationFailure(NavigationFailureType.aborted, context.to, context.from, error),
      }
    }
  }
  return { status: 'continue' }
}

export function executeNavigationMethod(
  method: (options: Record<string, any>) => unknown,
  options: Record<string, any>,
  to?: RouteLocationNormalizedLoaded,
  from?: RouteLocationNormalizedLoaded,
): Promise<void | NavigationFailure> {
  return new Promise((resolve) => {
    let settled = false
    const finalize = (result?: void | NavigationFailure) => {
      if (settled) {
        return
      }
      settled = true
      resolve(result)
    }

    try {
      const maybePromise = method({
        ...options,
        success: () => finalize(),
        fail: (error: unknown) => {
          finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error))
        },
      })

      if (maybePromise && typeof (maybePromise as PromiseLike<unknown>).then === 'function') {
        ;(maybePromise as PromiseLike<unknown>).then(
          () => finalize(),
          error => finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error)),
        )
      }
    }
    catch (error) {
      finalize(createNavigationFailure(resolveNavigationFailureType(error), to, from, error))
    }
  })
}

export async function runAfterEachHooks(
  hooks: ReadonlySet<NavigationAfterEach>,
  context: NavigationAfterEachContext,
) {
  for (const hook of hooks) {
    try {
      await hook(context.to, context.from, context.failure, context)
    }
    catch {
      // 忽略 afterEach hook 的异常，避免影响导航主流程。
    }
  }
}

export async function runNavigationErrorHooks(
  handlers: ReadonlySet<NavigationErrorHandler>,
  error: unknown,
  context: NavigationErrorContext,
) {
  for (const handler of handlers) {
    try {
      await handler(error, context)
    }
    catch {
      // 忽略 onError 回调中的异常，避免影响导航主流程。
    }
  }
}

function isNativeFailureLikeError(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }
  const errMsg = (value as Record<string, unknown>).errMsg
  return typeof errMsg === 'string'
}

export function shouldEmitNavigationError(failure: NavigationFailure): boolean {
  if (failure.type === NavigationFailureType.unknown) {
    return true
  }
  if (failure.cause instanceof Error) {
    return true
  }
  if (failure.type === NavigationFailureType.aborted && failure.cause !== undefined) {
    if (typeof failure.cause === 'string') {
      return false
    }
    if (isNativeFailureLikeError(failure.cause)) {
      return false
    }
    return true
  }
  return false
}
