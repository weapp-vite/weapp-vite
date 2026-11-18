import type { WevuNamedRouteMap } from '../router'
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
import { hasOwn, isThenable } from '../utils'
import { NavigationFailureType } from './types'

const DUPLICATED_RE = /already|same|duplicat|重复/
const CANCELLED_RE = /cancel|取消/
const ABORTED_RE = /abort|interrupt|中断/

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
  if (DUPLICATED_RE.test(normalizedMessage)) {
    return NavigationFailureType.duplicated
  }
  if (CANCELLED_RE.test(normalizedMessage)) {
    return NavigationFailureType.cancelled
  }
  if (ABORTED_RE.test(normalizedMessage)) {
    return NavigationFailureType.aborted
  }
  return NavigationFailureType.unknown
}

export function createNavigationFailure<TRouteMap extends object = WevuNamedRouteMap>(
  type: NavigationFailureTypeValue,
  to?: RouteLocationNormalizedLoaded<NoInfer<TRouteMap>>,
  from?: RouteLocationNormalizedLoaded<NoInfer<TRouteMap>>,
  cause?: unknown,
): NavigationFailure<TRouteMap> {
  const message = normalizeNavigationErrorMessage(cause) || 'Navigation failed'
  return Object.assign(new Error(message), {
    __wevuNavigationFailure: true as const,
    type,
    to,
    from,
    cause,
  })
}

export function isNavigationFailure<TRouteMap extends object = WevuNamedRouteMap>(
  error: unknown,
  type?: NavigationFailureTypeValue,
): error is NavigationFailure<TRouteMap> {
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
  return hasOwn(value, 'to')
}

/**
 * 判断守卫/校验返回值是否为普通 Error（非 NavigationFailure）。
 *
 * 对齐 Vue Router：守卫返回 Error 表示以该错误中止导航。
 * 必须排除 NavigationFailure——它是 Error 子类且携带内部标记与 type，
 * 应原样透传而不是被降级成 unknown 中止。
 */
export function isNavigationError(value: unknown): value is Error {
  return value instanceof Error && !isNavigationFailure(value)
}

/**
 * 判断校验/守卫返回值是否为原始位置。
 *
 * 字符串与含位置字段的对象都算原始位置：它们必须交给框架解析，
 * 直接当成已解析位置使用会得到没有 `fullPath` 的畸形位置。
 *
 * 只认自有字段：用 `in` 会把原型链上的字段算进来，
 * 普通 Error 的原型链带 `name`（值为 "Error"）会被误判为具名路由。
 */
export function isRouteLocationRawCandidate(value: unknown): value is RouteLocationRaw {
  if (typeof value === 'string') {
    return true
  }
  if (!value || typeof value !== 'object') {
    return false
  }
  return hasOwn(value, 'path')
    || hasOwn(value, 'fullPath')
    || hasOwn(value, 'query')
    || hasOwn(value, 'hash')
    || hasOwn(value, 'name')
    || hasOwn(value, 'params')
}

/** 判定一份「拦截返回值」所需的共性依赖。 */
export interface GuardResolutionContext {
  readonly to: RouteLocationNormalizedLoaded | undefined
  readonly from: RouteLocationNormalizedLoaded
  readonly resolveRoute: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded
}

/**
 * 把改道返回值归一化为「目标位置 + replace」。
 *
 * `{ to, replace }` 取 `to` 与三态 replace；裸原始位置直接解析、不声明 replace。
 * 相对路径以导航起点为基准，避免对象形态与字符串形态落进两条解析路径。
 */
export function resolveRedirectTarget(
  value: unknown,
  from: RouteLocationNormalizedLoaded,
  resolveRoute: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): { target: RouteLocationNormalizedLoaded, replace?: boolean } | undefined {
  if (isNavigationRedirectCandidate(value)) {
    return { target: resolveRoute(value.to, from.path), replace: value.replace }
  }
  if (isRouteLocationRawCandidate(value)) {
    return { target: resolveRoute(value, from.path) }
  }
  return undefined
}

/**
 * 把守卫 / 驱动校验的返回值归一化为流水线走向。
 *
 * 两类拦截共用同一份返回契约（NavigationGuardResult），判定必须只有一处：
 * failure 透传、Error 保留 message 中止、false 中止、raw / NavigationRedirect 改道。
 * 中止文案与「是否禁止改道」由 context 决定——校验发生在前进导航、守卫可能发生在返回导航。
 *
 * 相对路径以导航起点 `from.path` 为基准，与 router.resolve、驱动改道、路由记录改道同源。
 */
export function resolveGuardResult(
  result: unknown,
  context: GuardResolutionContext,
  abortMessage: string,
): GuardPipelineResult {
  if (isNavigationFailure(result)) {
    return { status: 'failure', failure: result }
  }
  if (isNavigationError(result)) {
    return {
      status: 'failure',
      failure: createNavigationFailure(NavigationFailureType.aborted, context.to, context.from, result),
    }
  }
  if (result === false) {
    return {
      status: 'failure',
      failure: createNavigationFailure(NavigationFailureType.aborted, context.to, context.from, abortMessage),
    }
  }
  const redirect = resolveRedirectTarget(result, context.from, context.resolveRoute)
  if (redirect) {
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
    return { status: 'redirect', target: redirect.target, replace: redirect.replace }
  }
  return { status: 'continue' }
}

export async function runNavigationGuards(
  guards: ReadonlySet<NavigationGuard>,
  context: NavigationGuardContext,
  resolveRoute: (to: RouteLocationRaw, currentPath: string) => RouteLocationNormalizedLoaded,
): Promise<GuardPipelineResult> {
  const resolutionContext: GuardResolutionContext = {
    to: context.to,
    from: context.from,
    resolveRoute,
  }
  for (const guard of guards) {
    try {
      const result = await guard(context.to, context.from, context)
      const outcome = resolveGuardResult(result, resolutionContext, 'Navigation aborted by guard')
      if (outcome.status !== 'continue') {
        return outcome
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

      if (isThenable(maybePromise)) {
        maybePromise.then(
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
