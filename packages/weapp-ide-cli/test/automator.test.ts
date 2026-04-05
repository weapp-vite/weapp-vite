import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isDevtoolsExtensionContextInvalidatedError,
  isDevtoolsHttpPortError,
  isRetryableAutomatorLaunchError,
  launchAutomator,
} from '../src/cli/automator'

const launchMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-vite/miniprogram-automator', () => ({
  Launcher: class {
    launch = launchMock
  },
}))

vi.mock('../src/cli/resolver', () => ({
  resolveCliPath: resolveCliPathMock,
}))

describe('automator helpers', () => {
  beforeEach(() => {
    launchMock.mockReset()
    resolveCliPathMock.mockReset()
    resolveCliPathMock.mockResolvedValue({ cliPath: '/Applications/wechat-cli', source: 'custom' })
    launchMock.mockResolvedValue({ connected: true })
  })

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

  describe('isDevtoolsExtensionContextInvalidatedError', () => {
    it('recognises extension context invalidated errors', () => {
      const error = new Error('Extension context invalidated.')
      expect(isDevtoolsExtensionContextInvalidatedError(error)).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      const error = new Error('Some other error')
      expect(isDevtoolsExtensionContextInvalidatedError(error)).toBe(false)
    })
  })

  describe('isRetryableAutomatorLaunchError', () => {
    it('recognises launch timeout as retryable', () => {
      expect(isRetryableAutomatorLaunchError(new Error('Wait timed out after 15000 ms'))).toBe(true)
    })

    it('recognises websocket bootstrap errors as retryable', () => {
      expect(isRetryableAutomatorLaunchError(new Error('Failed connecting to ws://127.0.0.1:19510, check if target project window is opened with automation enabled'))).toBe(true)
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

  describe('launchAutomator', () => {
    it('uses resolved cliPath when caller does not provide one', async () => {
      await launchAutomator({
        projectPath: '/workspace/project',
        timeout: 12_345,
      })

      expect(resolveCliPathMock).toHaveBeenCalledTimes(1)
      expect(launchMock).toHaveBeenCalledWith({
        cliPath: '/Applications/wechat-cli',
        projectPath: '/workspace/project',
        timeout: 12_345,
      })
    })

    it('prefers explicit cliPath over resolved config', async () => {
      await launchAutomator({
        cliPath: '/custom/cli',
        projectPath: '/workspace/project',
      })

      expect(resolveCliPathMock).not.toHaveBeenCalled()
      expect(launchMock).toHaveBeenCalledWith({
        cliPath: '/custom/cli',
        projectPath: '/workspace/project',
        timeout: 30_000,
      })
    })

    it('retries once for retryable startup jitter', async () => {
      launchMock
        .mockRejectedValueOnce(new Error('Wait timed out after 15000 ms'))
        .mockResolvedValueOnce({ connected: true })

      await expect(launchAutomator({
        projectPath: '/workspace/project',
      })).resolves.toEqual({ connected: true })

      expect(launchMock).toHaveBeenCalledTimes(2)
    })
  })
})
