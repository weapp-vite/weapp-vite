import type { RouterNavigationContext } from './navigationContext'
import type { NavigationRunResult } from './navigationResult'
import type {
  NavigationFailure,
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from './types'
import { snapshotRouteLocation } from '../routerInternal/shared'
import { runBackNavigationGuards } from './backNavigation'
import {
  createNavigationFailure,
  isNavigationFailure,
} from './navigationCore'
import { createNavigationRunResult } from './navigationResult'
import { navigateWithTarget } from './navigationTarget'
import { NavigationFailureType } from './types'

interface CreateNavigationApiOptions {
  /** 导航内核共享依赖。 */
  context: RouterNavigationContext
  /** 读取当前路由快照。 */
  getRoute: () => Readonly<RouteLocationNormalizedLoaded>
  /** 目标位置确定后回调；前后退与前进后退共用同一个上报口。 */
  onTarget?: (target: RouteLocationNormalizedLoaded | undefined) => void
  /** 统一结算导航结果。 */
  settleNavigationResult: (result: NavigationRunResult) => Promise<void | NavigationFailure>
}

export function createNavigationApi(options: CreateNavigationApiOptions) {
  const {
    context,
    getRoute,
    onTarget,
    settleNavigationResult,
  } = options

  async function navigate(mode: 'push' | 'replace', to: RouteLocationRaw): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(getRoute())
    let target: RouteLocationNormalizedLoaded
    try {
      target = context.resolveWithCodec(to, from.path)
    }
    catch (error) {
      return settleNavigationResult(createNavigationRunResult(mode, from, undefined, createNavigationFailure(NavigationFailureType.unknown, undefined, from, error)))
    }
    // 目标位置只在这里解析一次：受管导航的目标路径由这里统一上报，避免上层重复解析。
    onTarget?.(target)
    const result = await navigateWithTarget(context, {
      mode,
      target,
      from,
    })
    return settleNavigationResult(result)
  }

  async function go(delta: number): Promise<void | NavigationFailure> {
    const from = snapshotRouteLocation(getRoute())
    try {
      const plan = context.history.resolveGo(delta, from)
      if (plan.noop) {
        return undefined
      }
      if (plan.failure) {
        return settleNavigationResult(createNavigationRunResult('back', from, plan.target, plan.failure))
      }
      onTarget?.(plan.target)
      const guardResult = await runBackNavigationGuards(context, {
        target: plan.target,
        from,
      })
      if (guardResult.failure) {
        return settleNavigationResult(guardResult)
      }
      const failure = await context.history.go(delta, plan.target, from)
      return settleNavigationResult(isNavigationFailure(failure)
        ? createNavigationRunResult('back', from, plan.target, failure)
        : guardResult)
    }
    catch (error) {
      return settleNavigationResult(createNavigationRunResult('back', from, undefined, createNavigationFailure(NavigationFailureType.unknown, undefined, from, error)))
    }
  }

  async function back(delta = 1): Promise<void | NavigationFailure> {
    return go(-delta)
  }

  async function forward(): Promise<void | NavigationFailure> {
    return go(1)
  }

  return {
    push: (to: RouteLocationRaw) => navigate('push', to),
    replace: (to: RouteLocationRaw) => navigate('replace', to),
    back,
    go,
    forward,
  }
}
