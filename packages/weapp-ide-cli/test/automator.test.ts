import { describe, expect, it } from 'vitest'
import {
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isDevtoolsHttpPortError,
} from '../src/cli/automator'

describe('automator helpers', () => {
  describe('isDevtoolsHttpPortError', () => {
    it('recognises HTTP port error message', () => {
      const error = new Error('Failed to launch wechat web devTools, please make sure http port is open')
      expect(isDevtoolsHttpPortError(error)).toBe(true)
    })

    it('recognises EPERM error', () => {
      const error = new Error('listen EPERM')
      expect(isDevtoolsHttpPortError(error)).toBe(true)
    })

    it('recognises ECONNREFUSED error', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:9420')
      expect(isDevtoolsHttpPortError(error)).toBe(true)
    })

    it('recognises EACCES error', () => {
      const error = new Error('EACCES: permission denied')
      expect(isDevtoolsHttpPortError(error)).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      const error = new Error('Some other error')
      expect(isDevtoolsHttpPortError(error)).toBe(false)
    })

    it('handles non-Error inputs', () => {
      expect(isDevtoolsHttpPortError('string error')).toBe(false)
      expect(isDevtoolsHttpPortError(null)).toBe(false)
      expect(isDevtoolsHttpPortError(undefined)).toBe(false)
    })
  })

  describe('isAutomatorLoginError', () => {
    it('recognises login-required errors from code', () => {
      const error = {
        message: 'Error: 需要重新登录 (code 10)',
        stderr: '[error] code: 10',
      }
      expect(isAutomatorLoginError(error)).toBe(true)
    })

    it('recognises login-required errors from Chinese message', () => {
      const error = { message: '需要重新登录' }
      expect(isAutomatorLoginError(error)).toBe(true)
    })

    it('recognises login-required errors from English message', () => {
      const error = { message: 'need re-login' }
      expect(isAutomatorLoginError(error)).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      const error = { message: 'spawn EACCES', stderr: 'permission denied' }
      expect(isAutomatorLoginError(error)).toBe(false)
    })

    it('returns false for invalid inputs', () => {
      expect(isAutomatorLoginError(undefined)).toBe(false)
      expect(isAutomatorLoginError('string')).toBe(false)
      expect(isAutomatorLoginError(null)).toBe(false)
    })
  })

  describe('formatAutomatorLoginError', () => {
    it('formats login-required errors with code and message', () => {
      const formatted = formatAutomatorLoginError({
        message: 'Error: 需要重新登录 (code 10)',
        stderr: '[error] code: 10',
      })

      expect(formatted).toContain('微信开发者工具返回登录错误：')
      expect(formatted).toContain('- code: 10')
      expect(formatted).toContain('- message: 需要重新登录')
    })

    it('formats errors with only message', () => {
      const formatted = formatAutomatorLoginError({
        message: 'need re-login',
      })

      expect(formatted).toContain('微信开发者工具返回登录错误：')
      expect(formatted).toContain('- message: need re-login')
    })

    it('provides default message when no specific info', () => {
      const formatted = formatAutomatorLoginError({
        message: 'Unknown error',
      })

      expect(formatted).toContain('微信开发者工具返回登录错误：')
      expect(formatted).toContain('- message: Unknown error')
    })
  })
})
