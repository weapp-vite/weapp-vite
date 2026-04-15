import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  connectOpenedAutomator,
  formatAutomatorLoginError,
  isAutomatorLoginError,
  isDevtoolsExtensionContextInvalidatedError,
  isDevtoolsHttpPortError,
  isRetryableAutomatorLaunchError,
  launchAutomator,
} from '../src/cli/automator'

const launchMock = vi.hoisted(() => vi.fn())
const connectMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())
const readCustomConfigMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const rmMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-vite/miniprogram-automator', () => ({
  Launcher: class {
    connect = connectMock
    launch = launchMock
  },
}))

vi.mock('../src/cli/resolver', () => ({
  resolveCliPath: resolveCliPathMock,
}))

vi.mock('../src/config/custom', () => ({
  readCustomConfig: readCustomConfigMock,
}))

vi.mock('../src/cli/wechatDevtoolsSettings', () => ({
  bootstrapWechatDevtoolsSettings: bootstrapWechatDevtoolsSettingsMock,
}))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mkdirMock,
    readFile: readFileMock,
    rm: rmMock,
    writeFile: writeFileMock,
  },
}))

describe('automator helpers', () => {
  beforeEach(() => {
    launchMock.mockReset()
    connectMock.mockReset()
    resolveCliPathMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    readCustomConfigMock.mockReset()
    mkdirMock.mockReset()
    writeFileMock.mockReset()
    readFileMock.mockReset()
    rmMock.mockReset()
    resolveCliPathMock.mockResolvedValue({ cliPath: '/Applications/wechat-cli', source: 'custom' })
    readCustomConfigMock.mockResolvedValue({})
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValue({
      touchedInstanceCount: 1,
      updatedSecurityCount: 1,
      trustedProjectCount: 1,
    })
    launchMock.mockResolvedValue({ connected: true })
    connectMock.mockResolvedValue({ connected: true })
    mkdirMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
    readFileMock.mockRejectedValue(new Error('missing'))
    rmMock.mockResolvedValue(undefined)
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

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        projectPath: '/workspace/project',
        trustProject: false,
      })
      expect(resolveCliPathMock).toHaveBeenCalledTimes(1)
      expect(launchMock).toHaveBeenCalledWith({
        cliPath: '/Applications/wechat-cli',
        projectPath: '/workspace/project',
        timeout: 12_345,
        trustProject: false,
      })
    })

    it('prefers explicit cliPath over resolved config', async () => {
      await launchAutomator({
        cliPath: '/custom/cli',
        projectPath: '/workspace/project',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        projectPath: '/workspace/project',
        trustProject: false,
      })
      expect(resolveCliPathMock).not.toHaveBeenCalled()
      expect(launchMock).toHaveBeenCalledWith({
        cliPath: '/custom/cli',
        projectPath: '/workspace/project',
        timeout: 30_000,
        trustProject: false,
      })
    })

    it('uses configured auto trust project when option is omitted', async () => {
      readCustomConfigMock.mockResolvedValueOnce({
        autoTrustProject: true,
      })

      await launchAutomator({
        projectPath: '/workspace/project',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        projectPath: '/workspace/project',
        trustProject: true,
      })
      expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
        trustProject: true,
      }))
    })

    it('skips devtools bootstrap when config disables it', async () => {
      readCustomConfigMock.mockResolvedValueOnce({
        autoBootstrapDevtools: false,
      })

      await launchAutomator({
        projectPath: '/workspace/project',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).not.toHaveBeenCalled()
      expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
        trustProject: false,
      }))
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

    it('persists websocket session metadata after launch', async () => {
      launchMock.mockResolvedValueOnce({
        connected: true,
        __WEAPP_VITE_SESSION_METADATA: {
          wsEndpoint: 'ws://127.0.0.1:9420',
        },
      })

      await launchAutomator({
        projectPath: '/workspace/project',
        trustProject: true,
      })

      expect(launchMock).toHaveBeenCalledWith({
        cliPath: '/Applications/wechat-cli',
        projectPath: '/workspace/project',
        timeout: 30_000,
        trustProject: true,
      })
      expect(mkdirMock).toHaveBeenCalledTimes(1)
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('"wsEndpoint": "ws://127.0.0.1:9420"')
    })
  })

  describe('connectOpenedAutomator', () => {
    it('prefers persisted websocket endpoint for current project', async () => {
      readFileMock.mockResolvedValueOnce(JSON.stringify({
        projectPath: path.resolve('/workspace/project'),
        updatedAt: '2026-04-06T00:00:00.000Z',
        wsEndpoint: 'ws://127.0.0.1:19510',
      }))

      await connectOpenedAutomator({
        projectPath: '/workspace/project',
        timeout: 3_000,
      })

      expect(connectMock).toHaveBeenCalledWith({
        wsEndpoint: 'ws://127.0.0.1:19510',
      })
      expect(rmMock).not.toHaveBeenCalled()
    })

    it('removes stale persisted endpoint when connect fails', async () => {
      const error = new Error('connect failed')
      readFileMock.mockResolvedValueOnce(JSON.stringify({
        projectPath: path.resolve('/workspace/project'),
        updatedAt: '2026-04-06T00:00:00.000Z',
        wsEndpoint: 'ws://127.0.0.1:19510',
      }))
      connectMock.mockRejectedValueOnce(error)

      await expect(connectOpenedAutomator({
        projectPath: '/workspace/project',
      })).rejects.toThrow(error)

      expect(rmMock).toHaveBeenCalledTimes(1)
    })
  })
})
