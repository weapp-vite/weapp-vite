import type { HeadlessWxAccountInfo, HeadlessWxLoginFailResult, HeadlessWxLoginOption, HeadlessWxLoginSuccessResult } from '../host/wx/account'
import type { RuntimeScheduler } from '../kernel'

export interface HeadlessWxLoginMockDefinition {
  code?: string
  error?: string
  delay?: number
}

interface AccountStateOptions {
  accountInfo?: HeadlessWxAccountInfo
  strictMocks?: boolean
}

function cloneAccountInfo(info: HeadlessWxAccountInfo): HeadlessWxAccountInfo {
  return { miniProgram: { ...info.miniProgram } }
}

export function createHeadlessAccountState(
  scheduler: Pick<RuntimeScheduler, 'clearTimeout' | 'setTimeout'>,
  options: AccountStateOptions,
) {
  let accountInfo = cloneAccountInfo(options.accountInfo ?? { miniProgram: { appId: '', envVersion: 'develop', version: '' } })
  let closed = false
  let loginSequence = 0
  const mocks: HeadlessWxLoginMockDefinition[] = []
  const timers = new Set<ReturnType<typeof scheduler.setTimeout>>()

  return {
    close() {
      closed = true
      for (const timer of timers) {
        scheduler.clearTimeout(timer)
      }
      timers.clear()
      mocks.length = 0
    },
    getAccountInfoSync() {
      return cloneAccountInfo(accountInfo)
    },
    setAccountInfo(info: HeadlessWxAccountInfo) {
      accountInfo = cloneAccountInfo(info)
    },
    mockLogin(definition: HeadlessWxLoginMockDefinition = {}) {
      mocks.push({ ...definition })
    },
    login(option: HeadlessWxLoginOption = {}) {
      if (closed) {
        return
      }
      const mock = mocks.shift()
      const { complete, fail, success, timeout } = option
      const requestedDelay = mock?.delay
      const delay = typeof requestedDelay === 'number' && Number.isFinite(requestedDelay) ? Math.max(0, requestedDelay) : 0
      const timedOut = typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0 && timeout < delay
      const error = timedOut
        ? 'login:fail timeout'
        : !mock && options.strictMocks
            ? 'login:fail no mock matched in headless runtime'
            : mock?.error ? `login:fail ${mock.error}` : undefined
      const result: HeadlessWxLoginSuccessResult | HeadlessWxLoginFailResult = error
        ? { errMsg: error }
        : { code: mock?.code ?? `mpcore-login-${++loginSequence}`, errMsg: 'login:ok' }
      const timer = scheduler.setTimeout(() => {
        timers.delete(timer)
        if (closed) {
          return
        }
        try {
          if ('code' in result) {
            success?.(result)
          }
          else {
            fail?.(result)
          }
        }
        finally {
          if (!closed) {
            complete?.(result)
          }
        }
      }, timedOut ? timeout : delay)
      timers.add(timer)
    },
  }
}
