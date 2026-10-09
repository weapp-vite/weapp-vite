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
  persistOpenedAutomatorSession,
} from '../src/cli/automator'

const machineLeaseMock = vi.hoisted(() => vi.fn(async (run: () => Promise<unknown>) => await run()))
const launchMock = vi.hoisted(() => vi.fn())
const connectMock = vi.hoisted(() => vi.fn())
const resolveTargetMock = vi.hoisted(() => vi.fn())
const bootstrapWechatDevtoolsSettingsMock = vi.hoisted(() => vi.fn())
const readCustomConfigMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const rmMock = vi.hoisted(() => vi.fn())

vi.mock('@weapp-vite/miniprogram-automator', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/miniprogram-automator')>(),
  Launcher: class {
    connect = connectMock
    launch = launchMock
  },
}))

vi.mock('../src/devtoolsTarget', () => ({
  resolveWechatDevtoolsTarget: resolveTargetMock,
  assertWechatDevtoolsHost: vi.fn(),
  assertWechatDevtoolsPort: vi.fn(),
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
  const mockProjectPath = path.resolve('/workspace/project')

  beforeEach(() => {
    machineLeaseMock.mockClear()
    launchMock.mockReset()
    connectMock.mockReset()
    resolveTargetMock.mockReset()
    bootstrapWechatDevtoolsSettingsMock.mockReset()
    readCustomConfigMock.mockReset()
    mkdirMock.mockReset()
    writeFileMock.mockReset()
    readFileMock.mockReset()
    rmMock.mockReset()
    resolveTargetMock.mockImplementation(async ({ cliPath }: { cliPath?: string }) => ({ cliPath: cliPath ?? '/Applications/wechat-cli', installationId: 'test-installation', appPath: 'app', profileDir: 'profile' }))
    readCustomConfigMock.mockResolvedValue({})
    bootstrapWechatDevtoolsSettingsMock.mockResolvedValue({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
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

    it('recognises DevTools CLI IDE port timeout', () => {
      const error = new Error('#initialize-error: wait IDE port timeout')
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

  it('persists externally opened sessions with the selected installation identity', async () => {
    await persistOpenedAutomatorSession({
      cliPath: 'stable-cli',
      port: 19620,
      projectPath: mockProjectPath,
      wsEndpoint: 'ws://127.0.0.1:19620',
    })

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('weapp-vite-automator-sessions'),
      expect.stringContaining('"installationId": "test-installation"'),
      expect.objectContaining({ encoding: 'utf8' }),
    )
  })

  it('rejects non-loopback automator endpoints before persisting a session', async () => {
    await expect(persistOpenedAutomatorSession({
      cliPath: 'stable-cli',
      projectPath: mockProjectPath,
      wsEndpoint: 'ws://192.0.2.1:19620',
    })).rejects.toThrow('DEVTOOLS_SESSION_ENDPOINT_INVALID')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects a session port that differs from the websocket endpoint', async () => {
    await expect(persistOpenedAutomatorSession({
      cliPath: 'stable-cli',
      port: 19621,
      projectPath: mockProjectPath,
      wsEndpoint: 'ws://127.0.0.1:19620',
    })).rejects.toThrow('DEVTOOLS_SESSION_PORT_MISMATCH')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('rejects headless sessions instead of touching DevTools state', async () => {
    await expect(persistOpenedAutomatorSession({
      projectPath: mockProjectPath,
      runtimeProvider: 'headless',
      wsEndpoint: 'ws://127.0.0.1:19620',
    })).rejects.toThrow('DEVTOOLS_SESSION_PROVIDER_INVALID')
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('also persists an unqualified default session when no selector is provided', async () => {
    await persistOpenedAutomatorSession({
      cliPath: 'stable-cli',
      projectPath: mockProjectPath,
      wsEndpoint: 'ws://127.0.0.1:19620',
    })
    expect(writeFileMock).toHaveBeenCalledTimes(2)
    expect(writeFileMock.mock.calls[0]?.[1]).toContain('"port"')
    expect(writeFileMock.mock.calls[1]?.[1]).not.toContain('"port"')
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
    it('keeps headless launches outside IDE configuration and machine host operations', async () => {
      await launchAutomator({ projectPath: 'headless-project', runtimeProvider: 'headless' })
      expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({ projectPath: 'headless-project', runtimeProvider: 'headless' }))
      expect(machineLeaseMock).not.toHaveBeenCalled()
      expect(resolveTargetMock).not.toHaveBeenCalled()
      expect(readCustomConfigMock).not.toHaveBeenCalled()
      expect(bootstrapWechatDevtoolsSettingsMock).not.toHaveBeenCalled()
      expect(writeFileMock).not.toHaveBeenCalled()
    })

    it('uses resolved cliPath when caller does not provide one', async () => {
      await launchAutomator({
        projectPath: '/workspace/project',
        timeout: 12_345,
        port: 19_510,
        sessionId: 'worker-a',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        target: expect.objectContaining({ installationId: 'test-installation' }),
        projectPath: mockProjectPath,
        trustProject: false,
      })
      expect(resolveTargetMock).toHaveBeenCalledTimes(1)
      expect(launchMock).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        cliPath: '/Applications/wechat-cli',
        port: 19_510,
        projectPath: mockProjectPath,
        trustProject: false,
      })
    })

    it('prefers explicit cliPath over resolved config', async () => {
      await launchAutomator({
        cliPath: '/custom/cli',
        projectPath: '/workspace/project',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        target: expect.objectContaining({ installationId: 'test-installation' }),
        projectPath: mockProjectPath,
        trustProject: false,
      })
      expect(resolveTargetMock).toHaveBeenCalledExactlyOnceWith({ cliPath: '/custom/cli', projectPath: '/workspace/project' })
      expect(launchMock).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        cliPath: '/custom/cli',
        projectPath: mockProjectPath,
        trustProject: false,
      })
    })

    it('keeps the source project path when caller preserves project root', async () => {
      await launchAutomator({
        preserveProjectRoot: true,
        projectPath: '/workspace/project',
      })

      expect(readFileMock).not.toHaveBeenCalled()
      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        target: expect.objectContaining({ installationId: 'test-installation' }),
        projectPath: mockProjectPath,
        trustProject: false,
      })
      expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
        projectPath: mockProjectPath,
      }))
    })

    it('uses configured auto trust project when option is omitted', async () => {
      readCustomConfigMock.mockResolvedValueOnce({
        autoTrustProject: true,
      })

      await launchAutomator({
        projectPath: '/workspace/project',
      })

      expect(bootstrapWechatDevtoolsSettingsMock).toHaveBeenCalledWith({
        target: expect.objectContaining({ installationId: 'test-installation' }),
        projectPath: mockProjectPath,
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

    it('fails early when detected service port is disabled', async () => {
      bootstrapWechatDevtoolsSettingsMock.mockResolvedValueOnce({
        touchedInstanceCount: 1,
        detectedSecurityCount: 1,
        updatedSecurityCount: 0,
        trustedProjectCount: 1,
        servicePort: 21992,
        servicePortEnabled: false,
      })

      await expect(launchAutomator({
        projectPath: '/workspace/project',
      })).rejects.toThrow('Detected WeChat DevTools service port is disabled in current settings. Please enable it manually; existing user settings were not modified.')

      expect(launchMock).not.toHaveBeenCalled()
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

    it('does not retry after the launch timeout budget is exhausted', async () => {
      vi.useFakeTimers()
      launchMock.mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 30_000))
        throw new Error('Wait timed out after 30000 ms')
      })

      try {
        const launchPromise = launchAutomator({
          projectPath: '/workspace/project',
          timeout: 30_000,
        })
        const expectation = expect(launchPromise).rejects.toMatchObject({ code: 'DEVTOOLS_OPERATION_TIMEOUT' })

        await vi.advanceTimersByTimeAsync(30_000)
        await expectation
        expect(launchMock).toHaveBeenCalledTimes(1)
      }
      finally {
        vi.useRealTimers()
      }
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
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        cliPath: '/Applications/wechat-cli',
        projectPath: mockProjectPath,
        trustProject: true,
      })
      expect(mkdirMock).toHaveBeenCalledTimes(1)
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('"wsEndpoint": "ws://127.0.0.1:9420"')
      expect(String(writeFileMock.mock.calls[0]?.[1])).not.toContain('"port"')
    })

    it('persists explicit session metadata separately', async () => {
      launchMock.mockResolvedValueOnce({
        connected: true,
        __WEAPP_VITE_SESSION_METADATA: {
          port: 19_510,
          wsEndpoint: 'ws://127.0.0.1:19510',
        },
      })

      await launchAutomator({
        port: 19_510,
        projectPath: '/workspace/project',
        sessionId: 'worker-a',
      })

      expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
        port: 19_510,
      }))
      expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('"port": 19510')
      expect(String(writeFileMock.mock.calls[0]?.[1])).toContain('"sessionId": "worker-a"')
    })
  })

  describe('connectOpenedAutomator', () => {
    it('prefers persisted websocket endpoint for current project', async () => {
      readFileMock.mockResolvedValueOnce(JSON.stringify({
        installationId: 'test-installation',
        projectPath: path.resolve('/workspace/project'),
        updatedAt: '2026-04-06T00:00:00.000Z',
        wsEndpoint: 'ws://127.0.0.1:19510',
      }))

      await connectOpenedAutomator({
        projectPath: '/workspace/project',
        timeout: 3_000,
      })

      expect(connectMock).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        wsEndpoint: 'ws://127.0.0.1:19510',
      })
      expect(rmMock).not.toHaveBeenCalled()
    })

    it('rejects an explicit port without installation-bound project metadata', async () => {
      await expect(connectOpenedAutomator({ port: 19_510, projectPath: '/workspace/project' })).rejects.toThrow('DEVTOOLS_SESSION_IDENTITY_UNVERIFIED')
      expect(connectMock).not.toHaveBeenCalled()
    })

    it('matches persisted endpoint by session id and port', async () => {
      readFileMock.mockResolvedValueOnce(JSON.stringify({
        installationId: 'test-installation',
        port: 19_510,
        projectPath: path.resolve('/workspace/project'),
        sessionId: 'worker-a',
        updatedAt: '2026-04-06T00:00:00.000Z',
        wsEndpoint: 'ws://127.0.0.1:19510',
      }))

      await connectOpenedAutomator({
        port: 19_510,
        projectPath: '/workspace/project',
        sessionId: 'worker-a',
      })

      expect(connectMock).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        wsEndpoint: 'ws://127.0.0.1:19510',
      })
    })

    it('uses project-specific persisted endpoints for concurrent opened projects', async () => {
      readFileMock
        .mockResolvedValueOnce(JSON.stringify({
          installationId: 'test-installation',
          projectPath: path.resolve('/workspace/template-a'),
          updatedAt: '2026-04-06T00:00:00.000Z',
          wsEndpoint: 'ws://127.0.0.1:19510',
        }))
        .mockResolvedValueOnce(JSON.stringify({
          installationId: 'test-installation',
          projectPath: path.resolve('/workspace/template-b'),
          updatedAt: '2026-04-06T00:00:00.000Z',
          wsEndpoint: 'ws://127.0.0.1:19511',
        }))

      await connectOpenedAutomator({
        projectPath: '/workspace/template-a',
      })
      await connectOpenedAutomator({
        projectPath: '/workspace/template-b',
      })

      expect(connectMock).toHaveBeenNthCalledWith(1, {
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        wsEndpoint: 'ws://127.0.0.1:19510',
      })
      expect(connectMock).toHaveBeenNthCalledWith(2, {
        signal: expect.any(AbortSignal),
        timeout: expect.any(Number),
        wsEndpoint: 'ws://127.0.0.1:19511',
      })
    })

    it('preserves persisted endpoint when a read-only connection fails', async () => {
      const error = new Error('connect failed')
      readFileMock.mockResolvedValueOnce(JSON.stringify({
        installationId: 'test-installation',
        projectPath: path.resolve('/workspace/project'),
        updatedAt: '2026-04-06T00:00:00.000Z',
        wsEndpoint: 'ws://127.0.0.1:19510',
      }))
      connectMock.mockRejectedValueOnce(error)

      await expect(connectOpenedAutomator({
        projectPath: '/workspace/project',
      })).rejects.toThrow(error)

      expect(rmMock).not.toHaveBeenCalled()
    })
  })
})

vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<typeof import('@weapp-vite/devtools-runtime')>(),
  withMachineE2ELease: machineLeaseMock,
}))
