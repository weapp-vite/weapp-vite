import { describe, expect, it, vi } from 'vitest'
import { createNavigationFailure, NavigationFailureType } from 'wevu/router'
import { createNavigationCompletion } from '../../e2e-apps/template-wevu-regression/src/utils/navigationCompletion'

describe('portal navigation completion', () => {
  it('waits for the exact navigation Promise instead of target-page visibility', async () => {
    let complete!: () => void
    const promise = new Promise<void>(resolve => complete = resolve)
    const push = vi.fn(() => promise)
    const navigation = createNavigationCompletion(push)
    expect(navigation.pushTo('/pages/overview/index')).toBe(promise)
    let settled = false
    const waiting = navigation.waitForNavigation('/pages/overview/index').then((route) => {
      settled = true
      return route
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    complete()
    await expect(waiting).resolves.toBe('/pages/overview/index')
    expect(push).toHaveBeenCalledExactlyOnceWith('/pages/overview/index')
  })

  it('rejects missing or mismatched navigation without starting another call', async () => {
    const push = vi.fn(async () => {})
    const navigation = createNavigationCompletion(push)
    await expect(navigation.waitForNavigation('/target')).rejects.toThrow('No portal navigation')
    await navigation.pushTo('/other')
    await expect(navigation.waitForNavigation('/target')).rejects.toThrow('target mismatch')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('preserves a rejected native navigation error', async () => {
    const failure = new Error('navigateTo:fail timeout')
    const navigation = createNavigationCompletion(async () => {
      throw failure
    })
    const started = navigation.pushTo('/target')
    await expect(started).rejects.toBe(failure)
    await expect(navigation.waitForNavigation('/target')).rejects.toBe(failure)
  })

  it('fails when router.push resolves with a NavigationFailure', async () => {
    const failure = createNavigationFailure(NavigationFailureType.unknown, undefined, undefined, 'navigateTo:fail timeout')
    const navigation = createNavigationCompletion(async () => failure)
    await expect(navigation.pushTo('/target')).resolves.toBe(failure)
    await expect(navigation.waitForNavigation('/target')).rejects.toBe(failure)
  })
})
