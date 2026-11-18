import type { RouterNavigationContext } from './navigationContext'
import type { GuardPipelineResult } from './navigationCore'
import type { NavigationRunResult } from './navigationResult'
import type { RedirectMode } from './navigationTargetHelpers'
import type {
  NavigationMode,
  RouteLocationNormalizedLoaded,
} from './types'
import { resolveMatchedRouteRecord } from '../routerInternal/shared'
import { isThenable } from '../utils'
import {
  createNavigationFailure,
  isNavigationFailure,
  resolveGuardResult,
  runNavigationGuards,
} from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import {
  applyRedirectTransition,
  createRedirectCounter,
  createTooManyRedirectsFailure,
  resolveRedirectMode,
  resolveRouteRecordRedirect,
} from './navigationTargetHelpers'
import { NavigationFailureType } from './types'

interface NavigateWithTargetOptions {
  mode: Exclude<NavigationMode, 'back'>
  target: RouteLocationNormalizedLoaded
  from: RouteLocationNormalizedLoaded
  executeNative?: boolean
  allowSameLocation?: boolean
}

/**
 * 改道后的流水线走向。
 *
 * - `continue`：目标与模式都没有变化，按原流程继续；
 * - `restart`：改道成立，从流水线起点重跑；
 * - 导航结果：改道失败，导航到此结束并产出失败。
 */
type RedirectFlow = 'continue' | 'restart' | NavigationRunResult

async function runNavigationTarget(
  context: RouterNavigationContext,
  options: NavigateWithTargetOptions,
): Promise<NavigationRunResult> {
  const { from, executeNative = true, allowSameLocation = false } = options
  const {
    history,
    nativeRouter,
    namedRouteLookup,
    beforeEachGuards,
    beforeResolveGuards,
    maxRedirects,
    resolveWithCodec,
    readGuardTarget,
  } = context
  let currentTarget = options.target
  let currentMode = options.mode
  const redirectCounter = createRedirectCounter(maxRedirects)

  /** 守卫只读取自定义位置表示；校验与提交仍使用原始解析，避免把目标改成当前位置。 */
  function createGuardContext(mode: NavigationMode) {
    return {
      mode,
      to: readGuardTarget(currentTarget),
      from: readGuardTarget(from),
      nativeRouter,
    }
  }

  /**
   * 应用一次重定向转移，并给出流水线走向。
   *
   * 超过重定向上限时直接产出失败结果：调用方只需区分「继续 / 重跑 / 结束」。
   */
  function applyRedirect(
    redirectedTarget: RouteLocationNormalizedLoaded,
    nextMode: RedirectMode,
  ): RedirectFlow {
    const transition = applyRedirectTransition({
      redirectedTarget,
      currentTarget,
      currentMode,
      nextMode,
    })
    if (!transition) {
      return 'continue'
    }
    currentTarget = readGuardTarget(transition.target)
    currentMode = transition.mode
    if (!redirectCounter.increase()) {
      return createNavigationRunResult(
        currentMode,
        from,
        currentTarget,
        createTooManyRedirectsFailure(currentTarget, from, maxRedirects),
      )
    }
    return 'restart'
  }

  /**
   * 把一个守卫结果落到流水线上：失败产出结果、改道应用转移、放行返回 continue。
   *
   * 守卫链有四处（校验、前置、前置路由守卫、解析前置）共用这套三态消费，
   * 收敛到这里后各调用点只需判断 continue / restart / 结束结果。
   */
  function settleGuard(
    outcome: GuardPipelineResult,
    defaultMode: RedirectMode,
  ): RedirectFlow {
    if (outcome.status === 'failure') {
      return createNavigationRunResult(currentMode, from, currentTarget, outcome.failure)
    }
    if (outcome.status === 'redirect') {
      return applyRedirect(outcome.target, resolveRedirectMode(outcome.replace, defaultMode))
    }
    return 'continue'
  }

  while (true) {
    // 驱动级校验是业务拦截的落点：位置表示由应用掌握，框架不参与判断。
    // 校验与守卫共用同一份返回契约，判定收敛到 resolveGuardResult：
    // failure / Error / false 中止、raw / NavigationRedirect 改道，与守卫完全同源。
    // 只有异步校验才等待：同步校验保持同步执行，初始导航的守卫仍在同一调用栈内被触发。
    const pendingCheck = history.check(currentTarget, from, allowSameLocation)
    const checkResult = isThenable(pendingCheck) ? await pendingCheck : pendingCheck
    const checkFlow = settleGuard(
      resolveGuardResult(checkResult, {
        to: currentTarget,
        from,
        resolveRoute: resolveWithCodec,
      }, 'Navigation aborted by history check'),
      currentMode,
    )
    if (checkFlow === 'restart') {
      continue
    }
    if (checkFlow !== 'continue') {
      return checkFlow
    }

    const beforeEachResult = await runNavigationGuards(beforeEachGuards, createGuardContext(currentMode), resolveWithCodec)
    const beforeEachFlow = settleGuard(beforeEachResult, currentMode)
    if (beforeEachFlow === 'restart') {
      continue
    }
    if (beforeEachFlow !== 'continue') {
      return beforeEachFlow
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

      const flow = settleGuard({
        status: 'redirect',
        target: redirectedByRecord.target,
        replace: redirectedByRecord.replace,
      }, 'replace')
      if (flow === 'restart') {
        redirectedByRouteRecord = true
        break
      }
      if (flow !== 'continue') {
        return flow
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
      const beforeEnterResult = await runNavigationGuards(
        new Set(matchedRouteRecord.beforeEnterGuards),
        createGuardContext(currentMode),
        resolveWithCodec,
      )
      const flow = settleGuard(beforeEnterResult, currentMode)
      if (flow === 'restart') {
        redirectedByBeforeEnter = true
        break
      }
      if (flow !== 'continue') {
        return flow
      }
    }
    if (redirectedByBeforeEnter) {
      continue
    }

    const beforeResolveResult = await runNavigationGuards(beforeResolveGuards, createGuardContext(currentMode), resolveWithCodec)
    const beforeResolveFlow = settleGuard(beforeResolveResult, currentMode)
    if (beforeResolveFlow === 'restart') {
      continue
    }
    if (beforeResolveFlow !== 'continue') {
      return beforeResolveFlow
    }

    if (!executeNative) {
      return createNavigationRunResult(currentMode, from, currentTarget)
    }

    const result = await history[currentMode](currentTarget, from)
    if (isNavigationFailure(result)) {
      return createNavigationRunResult(currentMode, from, currentTarget, result)
    }
    return createNavigationRunResult(currentMode, from, currentTarget)
  }
}

export async function navigateWithTarget(
  context: RouterNavigationContext,
  options: NavigateWithTargetOptions,
): Promise<NavigationRunResult> {
  try {
    return await runNavigationTarget(context, options)
  }
  catch (error) {
    return createNavigationRunResult(options.mode, options.from, options.target, createNavigationFailure(NavigationFailureType.unknown, options.target, options.from, error))
  }
}
