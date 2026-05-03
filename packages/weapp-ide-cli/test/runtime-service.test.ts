import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  success: vi.fn(),
}))

vi.mock('../src/logger', () => ({
  colors: {
    cyan: (value: string) => value,
  },
  default: loggerMock,
}))

async function loadModule() {
  return import('../src/cli/runtime-service')
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json',
    },
    status,
  })
}

describe('runtime service command bridge', () => {
  const fetchMock = vi.fn()
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    loggerMock.success.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env.WEAPP_VITE_RUNTIME_REST_URL
    delete process.env.WEAPP_IDE_CLI_RUNTIME_REST_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    logSpy.mockRestore()
  })

  it('routes navigate commands through the runtime service', async () => {
    const { tryRunRuntimeServiceCommand } = await loadModule()
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      result: {
        transition: 'navigateTo',
        url: '/pages/detail/index',
      },
    }))

    const handled = await tryRunRuntimeServiceCommand('navigate', [
      'pages/detail/index',
      '-p',
      'templates/demo',
      '--runtime-url',
      'http://127.0.0.1:3088/api/weapp/devtools',
    ])

    expect(handled).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3088/api/weapp/devtools/route', expect.objectContaining({
      method: 'POST',
    }))
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      path: 'pages/detail/index',
      projectPath: path.resolve('templates/demo'),
      transition: 'navigateTo',
    })
    expect(loggerMock.success).toHaveBeenCalledWith(expect.stringContaining('runtime service'))
  })

  it('captures screenshots through the same runtime service after optional page route', async () => {
    const { tryRunRuntimeServiceCommand } = await loadModule()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        result: {
          transition: 'reLaunch',
          url: '/pages/home/home',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        result: {
          bytes: 3,
          path: path.resolve('screenshots/home.png'),
        },
      }))

    const handled = await tryRunRuntimeServiceCommand('screenshot', [
      '-p',
      'templates/demo',
      '--page',
      'pages/home/home',
      '--output',
      'screenshots/home.png',
      '--json',
    ])

    expect(handled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      path: 'pages/home/home',
      transition: 'reLaunch',
    })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toMatchObject({
      outputPath: path.resolve('screenshots/home.png'),
      projectPath: path.resolve('templates/demo'),
    })
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ path: 'screenshots/home.png' }, null, 2))
  })

  it('falls back to direct automator when the runtime service is unavailable', async () => {
    const { tryRunRuntimeServiceCommand } = await loadModule()
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('connect refused'), {
      cause: {
        code: 'ECONNREFUSED',
      },
    }))

    await expect(tryRunRuntimeServiceCommand('current-page', ['-p', 'templates/demo'])).resolves.toBe(false)
  })

  it('can be disabled per command', async () => {
    const { tryRunRuntimeServiceCommand } = await loadModule()

    await expect(tryRunRuntimeServiceCommand('navigate', ['pages/home/home', '--no-runtime-service'])).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
