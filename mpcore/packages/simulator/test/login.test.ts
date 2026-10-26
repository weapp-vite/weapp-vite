import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDirs } from './helpers'
import { basicApisFiles } from './helpers/basicApis'
import { createBasicApisSession } from './helpers/basicApisSession'

describe('local login mocks', () => {
  const directories: string[] = []
  afterEach(() => {
    vi.useRealTimers()
    cleanupTempDirs(directories)
  })

  for (const provider of ['node', 'browser'] as const) {
    it(`consumes login mocks in invocation order in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      const first = { code: 'first-code', delay: 30 }
      session.mockLogin(first)
      session.mockLogin({ error: 'denied', delay: 10 })
      first.code = 'mutated-input'
      try {
        const page = session.reLaunch('/pages/index/index')
        page.login()
        page.login()
        expect(page.data.callbacks).toEqual([])
        await vi.advanceTimersByTimeAsync(10)
        expect(page.data.results).toEqual([{ errMsg: 'login:fail denied' }, { errMsg: 'login:fail denied' }])
        await vi.advanceTimersByTimeAsync(20)
        expect(page.data.callbacks).toEqual(['fail', 'complete', 'success', 'complete'])
        expect(page.data.results.slice(2)).toEqual([
          { code: 'first-code', errMsg: 'login:ok' },
          { code: 'first-code', errMsg: 'login:ok' },
        ])
      }
      finally {
        session.close()
      }
    })

    it(`requires explicit login mocks in strict mode in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories, basicApisFiles(), true)
      try {
        const page = session.reLaunch('/pages/index/index')
        page.login()
        expect(page.data.callbacks).toEqual([])
        await vi.runAllTimersAsync()
        expect(page.data.callbacks).toEqual(['fail', 'complete'])
        expect(page.data.error).toBe('login:fail no mock matched in headless runtime')
        session.mockLogin({ code: 'strict-code' })
        page.login()
        await vi.runAllTimersAsync()
        expect(page.data.callbacks).toEqual(['fail', 'complete', 'success', 'complete'])
        expect(page.data.code).toBe('strict-code')
      }
      finally {
        session.close()
      }
    })

    it(`times out a delayed login exactly once in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      session.mockLogin({ code: 'late-code', delay: 50 })
      try {
        const page = session.reLaunch('/pages/index/index')
        page.login({ timeout: 10 })
        await vi.advanceTimersByTimeAsync(9)
        expect(page.data.callbacks).toEqual([])
        await vi.advanceTimersByTimeAsync(1)
        expect(page.data.callbacks).toEqual(['fail', 'complete'])
        expect(page.data.error).toBe('login:fail timeout')
        await vi.advanceTimersByTimeAsync(50)
        expect(page.data.callbacks).toEqual(['fail', 'complete'])
        expect(page.data.code).toBe('')
      }
      finally {
        session.close()
      }
    })

    it(`cancels pending logins when the session closes in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      session.mockLogin({ code: 'cancelled-code', delay: 20 })
      const page = session.reLaunch('/pages/index/index')
      page.login()
      session.close()
      session.close()
      await vi.runAllTimersAsync()
      expect(page.data.callbacks).toEqual([])
      expect(page.data.code).toBe('')
      expect(vi.getTimerCount()).toBe(0)
    })

    it(`captures callbacks at invocation time in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      try {
        const page = session.reLaunch('/pages/index/index')
        page.mutateLoginCallbacks()
        await vi.runAllTimersAsync()
        expect(page.data.callbacks).toEqual(['success', 'complete'])
      }
      finally {
        session.close()
      }
    })

    it(`still calls complete when success throws in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      try {
        const page = session.reLaunch('/pages/index/index')
        page.login({ throwOnSuccess: true })
        await vi.runAllTimersAsync()
        expect(page.data.callbacks).toEqual(['success', 'complete'])
        expect(session.getDiagnostics()).toEqual([
          expect.objectContaining({ level: 'exception', args: [expect.objectContaining({ message: 'login callback failed' })] }),
        ])
      }
      finally {
        session.close()
      }
    })

    it(`keeps generated codes local to each session in ${provider}`, async () => {
      vi.useFakeTimers()
      const first = createBasicApisSession(provider, directories)
      const second = createBasicApisSession(provider, directories)
      try {
        const firstPage = first.reLaunch('/pages/index/index')
        const secondPage = second.reLaunch('/pages/index/index')
        firstPage.login()
        firstPage.login()
        secondPage.login()
        await vi.runAllTimersAsync()
        expect(firstPage.data.results.filter((_: unknown, index: number) => index % 2 === 0)).toEqual([
          { code: 'mpcore-login-1', errMsg: 'login:ok' },
          { code: 'mpcore-login-2', errMsg: 'login:ok' },
        ])
        expect(secondPage.data.code).toBe('mpcore-login-1')
      }
      finally {
        first.close()
        second.close()
      }
    })
  }
})
