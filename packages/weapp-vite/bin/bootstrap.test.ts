import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatPrepareSkipMessage, guardKnownLocalPkgResolveNoise, guardPrepareProcessExit, runWeappViteCLI } from './bootstrap.js'

describe('bin bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('guards process exit state for prepare at bin level', () => {
    process.exitCode = 1
    const restore = guardPrepareProcessExit(['prepare'])

    process.exitCode = 2
    expect(process.exitCode).toBe(0)

    process.exit(3)
    expect(process.exitCode).toBe(0)

    // prepare keeps the guard for the current process lifetime
    restore()
    expect(process.exitCode).toBe(0)
  })

  it('swallows bootstrap failures for prepare', async () => {
    const write = vi.fn()
    const importer = vi.fn().mockRejectedValue(new Error('Cannot find module ../dist/cli.mjs'))

    await expect(runWeappViteCLI({
      argv: ['prepare'],
      importer,
      write,
    })).resolves.toBe(false)

    expect(write).toHaveBeenCalledWith(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：Cannot find module ../dist/cli.mjs',
    )
  })

  it('keeps other commands failing during bootstrap', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(runWeappViteCLI({
      argv: ['build'],
      importer,
    })).rejects.toThrow('boom')
  })

  it('formats non-error values', () => {
    expect(formatPrepareSkipMessage('boom')).toBe(
      '[prepare] 跳过 .weapp-vite 支持文件预生成：boom',
    )
  })

  it('prevents async prepare importers from leaving a failure exit code behind', async () => {
    process.exitCode = undefined
    const importer = vi.fn().mockImplementation(async () => {
      process.exitCode = 1
    })

    await expect(runWeappViteCLI({
      argv: ['prepare'],
      importer,
    })).resolves.toBe(true)

    expect(process.exitCode).toBe(0)
  })

  it('suppresses known local-pkg resolve noise during bootstrap', () => {
    const consoleErrorSpy = vi.fn()
    // eslint-disable-next-line no-console -- 测试里需要替换 console.error
    const originalConsoleError = console.error
    // eslint-disable-next-line no-console -- 测试里需要观察过滤后的 console.error
    console.error = consoleErrorSpy

    const restore = guardKnownLocalPkgResolveNoise()
    try {
      // eslint-disable-next-line no-console -- 触发已知噪音分支
      console.error(new Error('TypeError [ERR_INVALID_FILE_URL_HOST]: File URL host must be "localhost" or empty on darwin\n    at _resolve (/tmp/local-pkg/dist/index.mjs:1:1)\n    at resolveSync (/tmp/mlly/dist/index.mjs:1:1)'))
      // eslint-disable-next-line no-console -- 触发普通错误透传分支
      console.error(new Error('boom'))
    }
    finally {
      restore()
      // eslint-disable-next-line no-console -- 恢复测试前的 console.error
      console.error = originalConsoleError
    }

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toBeInstanceOf(Error)
    expect(consoleErrorSpy.mock.calls[0]?.[0]?.message).toBe('boom')
  })
})
