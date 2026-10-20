import type { RelaunchFailureContext, RelaunchFailureObserver } from './automatorRelaunchFailure'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enhanceMiniProgramRelaunch } from './automator'
import { appendIdeReportEvent } from './ideWarningReport'

vi.mock('./ideWarningReport', () => ({ appendIdeReportEvent: vi.fn(), resolveReportProjectPath: () => 'fixture' }))

const route = '/pages/index/index?force=1'
const options = { project: 'fixture', retryDelayMs: 0, rootSelectors: ['#external-page'] }

function page(pageId: string, rendered = false, path = 'pages/index/index') {
  return {
    pageId,
    path,
    waitFor: vi.fn((delay: number) => new Promise<void>(resolve => setTimeout(resolve, delay))),
    waitForRendered: vi.fn(async () => {
      if (!rendered) {
        throw new Error('No rendered node')
      }
      return { selector: '#external-page' }
    }),
    $$: vi.fn(async () => rendered ? [{ selector: '#external-page' }] : []),
  }
}

async function settle<T>(pending: Promise<T>) {
  const result = pending.then(value => ({ value }), error => ({ error }))
  await vi.runAllTimersAsync()
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(appendIdeReportEvent).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('relaunch failure observation before the existing close', () => {
  it('leaves the externally awaited page unassigned on the original root failure', async () => {
    const returned = page('5')
    const miniProgram = { reLaunch: vi.fn(async (_route: string) => returned), currentPage: vi.fn(async () => page('6')), close: vi.fn(async () => {}) }
    enhanceMiniProgramRelaunch(miniProgram, options)
    let externalPage: unknown
    const result = await settle((async () => {
      externalPage = await miniProgram.reLaunch(route)
    })())
    expect(result).toHaveProperty('error')
    expect(externalPage).toBeUndefined()
    expect(miniProgram.close).toHaveBeenCalledOnce()
  })

  it('does not invoke the observer on direct success or an existing successful fallback', async () => {
    for (const recover of [false, true]) {
      const returned = page('5', true)
      const observe = vi.fn()
      const remainingMs = vi.fn(() => 10_000)
      const miniProgram = {
        reLaunch: recover
          ? vi.fn(async (_route: string) => {
              throw new Error('Uncaught [object Object]')
            })
          : vi.fn(async (_route: string) => returned),
        currentPage: vi.fn(async () => returned),
        close: vi.fn(async () => {}),
      }
      enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: { observe, remainingMs } })
      expect(await settle(miniProgram.reLaunch(route))).toEqual({ value: returned })
      expect(observe).not.toHaveBeenCalled()
      expect(remainingMs).not.toHaveBeenCalled()
      expect(miniProgram.close).not.toHaveBeenCalled()
    }
  })

  it('does not invoke the observer when the existing second attempt succeeds', async () => {
    const returned = page('5', true)
    const observe = vi.fn()
    const rawReLaunch = vi.fn().mockRejectedValueOnce(new Error('Uncaught [object Object]')).mockResolvedValue(returned)
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => page('6', false, 'pages/other/index')), close: vi.fn(async () => {}) }
    enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: { observe, remainingMs: () => 10_000 } })
    expect(await settle(miniProgram.reLaunch(route))).toEqual({ value: returned })
    expect(rawReLaunch).toHaveBeenCalledTimes(2)
    expect(observe).not.toHaveBeenCalled()
    expect(miniProgram.close).not.toHaveBeenCalled()
  })

  it.each(['simulator', 'root'] as const)('observes once before the %s failure close and rethrows the same error', async (branch) => {
    const originalError = new Error('simulator launch failed')
    const events: string[] = []
    const returned = page('5')
    const rawReLaunch = branch === 'simulator'
      ? vi.fn(async (_route: string) => {
          throw originalError
        })
      : vi.fn(async (_route: string) => returned)
    const miniProgram = {
      reLaunch: rawReLaunch,
      currentPage: vi.fn(async () => page('6')),
      close: vi.fn(async () => {
        events.push('close')
      }),
    }
    let observed: RelaunchFailureContext | undefined
    const observe = vi.fn((context: RelaunchFailureContext) => {
      events.push('observe')
      observed = context
      expect(miniProgram.close).not.toHaveBeenCalled()
    })
    enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: { observe, remainingMs: () => 10_000 } })
    const result = await settle(miniProgram.reLaunch(route))
    expect(events).toEqual(['observe', 'close'])
    expect(observe).toHaveBeenCalledOnce()
    expect(miniProgram.close).toHaveBeenCalledOnce()
    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect('error' in result ? result.error : undefined).toBe(observed!.originalError)
    if (branch === 'simulator') {
      expect(observed!.originalError).toBe(originalError)
      expect(observed!.fallback.attempted).toBe(false)
      expect(miniProgram.currentPage).not.toHaveBeenCalled()
    }
    else {
      expect(observed!.rawReturnedPage.pageId).toBe('5')
      expect(observed!.observedCurrentPage.pageId).toBe('6')
      expect(observed!.observedCurrentPage.options).toMatchObject({ appFunctionFallback: false, pageStackFallback: false, retries: 1 })
      expect(observed!.fallback).toMatchObject({ attempted: true, routeMatched: true, rootResult: 'missing' })
    }
  })

  it.each(['throw', 'timeout', 'budget-throw', 'budget-empty'] as const)('preserves original error and close once when observation has %s', async (mode) => {
    const originalError = new Error('simulator launch failed')
    const rawReLaunch = vi.fn(async (_route: string) => {
      throw originalError
    })
    const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(), close: vi.fn(async () => {}) }
    const observe = vi.fn(() => {
      if (mode === 'throw') {
        throw new Error('observer failed')
      }
      return new Promise<void>(() => {})
    })
    const observer: RelaunchFailureObserver = {
      observe,
      timeoutMs: 20,
      remainingMs: () => {
        if (mode === 'budget-throw') {
          throw new Error('budget unavailable')
        }
        return mode === 'budget-empty' ? Number.NaN : 10_000
      },
    }
    enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: observer })
    const result = await settle(miniProgram.reLaunch(route))
    expect('error' in result ? result.error : undefined).toBe(originalError)
    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect(miniProgram.currentPage).not.toHaveBeenCalled()
    expect(miniProgram.close).toHaveBeenCalledOnce()
    expect(observe).toHaveBeenCalledTimes(mode.startsWith('budget') ? 0 : 1)
  })

  it.each(['stdout', 'report'] as const)('preserves the original error and close once when the pre-close %s log throws', async (mode) => {
    const originalError = new Error('simulator launch failed')
    const logError = new Error('diagnostic output unavailable')
    const writeStdout = process.stdout.write
    const output = vi.spyOn(process.stdout, 'write')
    if (mode === 'stdout') {
      output.mockImplementation((...args) => {
        if (String(args[0]).includes('[runtime:relaunch-session-close]')) {
          throw logError
        }
        return Reflect.apply(writeStdout, process.stdout, args) as boolean
      })
    }
    else {
      vi.mocked(appendIdeReportEvent).mockImplementationOnce(() => {
        throw logError
      })
    }
    const events: string[] = []
    const rawReLaunch = vi.fn(async (_route: string) => {
      throw originalError
    })
    const miniProgram = {
      reLaunch: rawReLaunch,
      currentPage: vi.fn(),
      close: vi.fn(async () => {
        events.push('close')
      }),
    }
    const observe = vi.fn((context: RelaunchFailureContext) => {
      expect(context.originalError).toBe(originalError)
      events.push('observe')
    })
    enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: { observe, remainingMs: () => 10_000 } })
    const result = await settle(miniProgram.reLaunch(route))
    expect(output.mock.calls.some(([chunk]) => String(chunk).includes('[runtime:relaunch-session-close]'))).toBe(true)
    if (mode === 'report') {
      expect(vi.mocked(appendIdeReportEvent).mock.calls[0]?.[0].channel).toBe('relaunch-session-close')
    }
    expect('error' in result ? result.error : undefined).toBe(originalError)
    expect(events).toEqual(['observe', 'close'])
    expect(observe).toHaveBeenCalledOnce()
    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect(miniProgram.currentPage).not.toHaveBeenCalled()
    expect(miniProgram.close).toHaveBeenCalledOnce()
  })

  it('keeps the existing fallback error and missing page identities without another current-page query', async () => {
    const originalError = new Error('Timeout in raw reLaunch')
    const fallbackError = new Error('current page unavailable')
    const rawReLaunch = vi.fn(async (_route: string) => {
      throw originalError
    })
    const miniProgram = {
      reLaunch: rawReLaunch,
      currentPage: vi.fn(async () => {
        throw fallbackError
      }),
      close: vi.fn(async () => {
        throw new Error('close failed')
      }),
    }
    let observed: RelaunchFailureContext | undefined
    const observe = vi.fn((context: RelaunchFailureContext) => {
      observed = context
    })
    enhanceMiniProgramRelaunch(miniProgram, { ...options, onRelaunchFailureBeforeClose: { observe, remainingMs: () => 10_000 } })
    const result = await settle(miniProgram.reLaunch(route))
    expect('error' in result ? result.error : undefined).toBe(originalError)
    expect(observed?.rawReturnedPage.status).toBe('unavailable')
    expect(observed?.observedCurrentPage.status).toBe('unavailable')
    expect(observed?.fallback.error?.message).toBe(fallbackError.message)
    expect(observe).toHaveBeenCalledOnce()
    expect(rawReLaunch).toHaveBeenCalledOnce()
    expect(miniProgram.currentPage).toHaveBeenCalledOnce()
    expect(miniProgram.close).toHaveBeenCalledOnce()
  })

  it('does not add navigation, root probes, current-page queries or retries when configured', async () => {
    const counts = []
    for (const enabled of [false, true]) {
      const returned = page('5')
      const current = page('6')
      const rawReLaunch = vi.fn(async (_route: string) => returned)
      const miniProgram = { reLaunch: rawReLaunch, currentPage: vi.fn(async () => current), close: vi.fn(async () => {}) }
      enhanceMiniProgramRelaunch(miniProgram, {
        ...options,
        ...(enabled ? { onRelaunchFailureBeforeClose: { observe: vi.fn(), remainingMs: () => 10_000 } } : {}),
      })
      await settle(miniProgram.reLaunch(route))
      counts.push({
        navigation: rawReLaunch.mock.calls.length,
        currentPage: miniProgram.currentPage.mock.calls.length,
        rawRoot: returned.waitForRendered.mock.calls.length,
        currentRoot: current.waitForRendered.mock.calls.length,
        close: miniProgram.close.mock.calls.length,
      })
    }
    expect(counts[1]).toEqual(counts[0])
    expect(counts[1]).toMatchObject({ navigation: 1, close: 1 })
  })
})
