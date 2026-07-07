import { describe, expect, it, vi } from 'vitest'
import { callRoutePageMethod, relaunchPage } from '../ide/github-issues.runtime.shared'

describe('github issues runtime shared relaunch helper', () => {
  it('relaunches when the current page is not the target route', async () => {
    const targetPage = {
      path: '/pages/index/index',
      waitFor: vi.fn(async () => {}),
    }
    const miniProgram = {
      currentPage: vi.fn(async () => ({
        path: '/pages/other/index',
        waitFor: vi.fn(async () => {}),
      })),
      reLaunch: vi.fn(async () => targetPage),
      evaluate: vi.fn(async () => '/pages/index/index'),
    }

    const page = await relaunchPage(miniProgram, '/pages/index/index', undefined, 1, {
      readiness: 'route',
    })

    expect(page).toBe(targetPage)
    expect(miniProgram.reLaunch).toHaveBeenCalledWith('/pages/index/index')
  })

  it('calls route page methods through app-service with a scoped protocol timeout', async () => {
    const previousGetCurrentPages = (globalThis as any).getCurrentPages
    ;(globalThis as any).getCurrentPages = () => [{
      route: 'pages/index/index',
      _runE2E: (value: string) => ({
        ok: true,
        value,
      }),
    }]
    const miniProgram = {
      evaluateWithOptions: vi.fn(async (evaluator: (...args: unknown[]) => unknown, _options: unknown, ...args: unknown[]) => evaluator(...args)),
    }

    try {
      await expect(callRoutePageMethod(miniProgram, '/pages/index/index?x=1#hash', '_runE2E', 'arg')).resolves.toEqual({
        ok: true,
        value: 'arg',
      })

      expect(miniProgram.evaluateWithOptions).toHaveBeenCalledWith(
        expect.any(Function),
        {
          timeout: 8_000,
        },
        '/pages/index/index?x=1#hash',
        '_runE2E',
        ['arg'],
      )
    }
    finally {
      ;(globalThis as any).getCurrentPages = previousGetCurrentPages
    }
  })
})
