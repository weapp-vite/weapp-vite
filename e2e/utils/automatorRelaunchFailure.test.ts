import type { RelaunchFailureContext, RelaunchFailureInput, RelaunchFailureObserverScope } from './automatorRelaunchFailure'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { observeRelaunchFailureBeforeClose, snapshotRelaunchPageIdentity } from './automatorRelaunchFailure'

function failureInput(): RelaunchFailureInput {
  return {
    originalError: Object.assign(new Error('original root timeout'), { code: 'TIMEOUT', method: 'Page.getElement' }),
    firstErrorObservedAt: new Date().toISOString(),
    failurePhase: 'page-root',
    route: '/pages/index/index',
    attempt: 1,
    rootSelectors: ['#external-page'],
    rawReturnedPage: { pageId: '5', path: 'pages/index/index' },
    observedCurrentPage: {
      page: { pageId: '6', path: 'pages/index/index' },
      observedAt: new Date().toISOString(),
      options: { appFunctionFallback: false, pageStackFallback: false, retries: 1, timeout: 1_500 },
    },
    fallback: { attempted: true, routeMatched: true, rootResult: 'missing' },
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('bounded relaunch failure observer', () => {
  it('does not create timers or read failure handles while disabled', async () => {
    const timer = vi.spyOn(globalThis, 'setTimeout')
    const input = failureInput()
    input.rawReturnedPage = {
      get pageId() {
        throw new Error('must not read')
      },
    }
    await expect(observeRelaunchFailureBeforeClose(undefined, input)).resolves.toEqual({ status: 'disabled' })
    expect(timer).not.toHaveBeenCalled()
  })

  it('keeps raw returned identity separate from the existing post-error observation', async () => {
    const input = failureInput()
    const observe = vi.fn(async (context: RelaunchFailureContext, scope: RelaunchFailureObserverScope) => {
      expect(context.originalError).toBe(input.originalError)
      expect(context.error).toMatchObject({ message: 'original root timeout', code: 'TIMEOUT', method: 'Page.getElement' })
      expect(context.rawReturnedPage).toEqual({ status: 'available', source: 'raw-reLaunch-return', pageId: '5', path: 'pages/index/index' })
      expect(context.observedCurrentPage).toMatchObject({ status: 'available', source: 'post-error-native-currentPage', pageId: '6', options: input.observedCurrentPage!.options })
      expect(scope.timeoutMs).toBe(2_250)
      expect(scope.signal.aborted).toBe(false)
    })
    await expect(observeRelaunchFailureBeforeClose({ observe, remainingMs: () => 10_000 }, input)).resolves.toEqual({ status: 'completed' })
    expect(observe).toHaveBeenCalledOnce()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, 100])('does not call the observer without a finite usable original budget (%s)', async (remainingMs) => {
    const observe = vi.fn()
    const timer = vi.spyOn(globalThis, 'setTimeout')
    await expect(observeRelaunchFailureBeforeClose({ observe, remainingMs: () => remainingMs }, failureInput())).resolves.toMatchObject({ status: 'blocked' })
    expect(observe).not.toHaveBeenCalled()
    expect(timer).not.toHaveBeenCalled()
  })

  it('contains a throwing budget provider and a throwing observer', async () => {
    const observe = vi.fn(() => {
      throw new Error('capture failed')
    })
    const failedBudget = () => {
      throw new Error('budget failed')
    }
    await expect(observeRelaunchFailureBeforeClose({ observe, remainingMs: failedBudget }, failureInput())).resolves.toMatchObject({ status: 'failed', error: { message: 'budget failed' } })
    expect(observe).not.toHaveBeenCalled()
    await expect(observeRelaunchFailureBeforeClose({ observe, remainingMs: () => 10_000 }, failureInput())).resolves.toMatchObject({ status: 'failed', error: { message: 'capture failed' } })
    expect(observe).toHaveBeenCalledOnce()
  })

  it('stops waiting within the original budget and absorbs a late rejection without a follow-up phase', async () => {
    vi.useFakeTimers()
    let scope: RelaunchFailureObserverScope | undefined
    let rejectLate!: (error: Error) => void
    const observe = vi.fn((_context: RelaunchFailureContext, observedScope: RelaunchFailureObserverScope) => {
      scope = observedScope
      return new Promise<void>((_resolve, reject) => {
        rejectLate = reject
      })
    })
    const pending = observeRelaunchFailureBeforeClose({ observe, remainingMs: () => 150, timeoutMs: 5_000 }, failureInput())
    await vi.advanceTimersByTimeAsync(49)
    expect(scope?.signal.aborted).toBe(false)
    expect(scope?.timeoutMs).toBe(50)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ status: 'timed-out' })
    expect(scope?.signal.aborted).toBe(true)
    // 本地超时不会取消这个 Promise；迟到 rejection 仍必须被消费。
    rejectLate(new Error('remote operation finished late'))
    await Promise.resolve()
    await Promise.resolve()
    expect(observe).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports unavailable identities without invoking page getters as protocol methods', async () => {
    const input = failureInput()
    input.rawReturnedPage = undefined
    input.observedCurrentPage = undefined
    const observe = vi.fn((context: RelaunchFailureContext) => {
      expect(context.rawReturnedPage).toMatchObject({ status: 'unavailable', source: 'raw-reLaunch-return' })
      expect(context.observedCurrentPage).toMatchObject({ status: 'unavailable', source: 'post-error-native-currentPage' })
    })
    await observeRelaunchFailureBeforeClose({ observe, remainingMs: () => 10_000 }, input)
    expect(observe).toHaveBeenCalledOnce()
    expect(snapshotRelaunchPageIdentity({
      get pageId() {
        throw new Error('unstable page identity')
      },
      path: 'pages/index/index',
    })).toMatchObject({ status: 'unavailable', path: 'pages/index/index' })
  })
})
