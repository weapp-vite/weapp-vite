import realProcess from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runBootstrapFixture } from '../test/helpers/bootstrapFixture'
import { formatPrepareSkipMessage, guardKnownLocalPkgResolveNoise, guardPrepareProcessExit, runWeappViteCLI } from './bootstrap.js'

describe('bin bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal('process', {
      ...realProcess,
      exitCode: undefined,
      exit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

describe('cold CLI bootstrap without workspace dist', () => {
  it('never reports a child terminated by a signal as successful', async () => {
    const outcome = await runBootstrapFixture(['--eval', 'process.kill(process.pid, "SIGTERM")']).then(
      result => ({ kind: 'exit' as const, result }),
      (error: unknown) => ({ kind: 'signal' as const, error }),
    )
    if (outcome.kind === 'exit') {
      // Windows 可能将强制终止表示为非零退出码，Unix 则通过 signal 报告。
      expect(outcome.result.exitCode).not.toBe(0)
    }
    else {
      expect(outcome.error).toMatchObject({ signal: 'SIGTERM' })
    }
  })

  it('keeps prepare successful and reports the missing CLI artifact in Chinese on stderr', async () => {
    const result = await runBootstrapFixture(['bin/weapp-vite.js', 'prepare'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('警告')
    expect(result.stderr).toContain('[prepare] 跳过 .weapp-vite 支持文件预生成：')
    expect(result.stderr.replaceAll('\\', '/')).toContain('dist/cli.mjs')
    expect(result.stderr).not.toContain('@weapp-core/logger')
  })

  it.each([
    ['build', 'cli.mjs'],
    ['dev', 'cli.mjs'],
    ['accept', 'cli-acceptance.mjs'],
    ['mcp', 'cli-acceptance.mjs'],
  ])('preserves the missing artifact failure for %s', async (command, artifact) => {
    const result = await runBootstrapFixture(['bin/weapp-vite.js', command])

    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('ERR_MODULE_NOT_FOUND')
    expect(result.stderr.replaceAll('\\', '/')).toContain(`dist/${artifact}`)
    expect(result.stderr).not.toContain('@weapp-core/logger')
  })

  it.each([
    { name: 'forced colors', env: { FORCE_COLOR: '1' }, colored: true },
    { name: 'disabled colors', env: { NO_COLOR: '1' }, colored: false },
    { name: 'NO_COLOR precedence', env: { FORCE_COLOR: '1', NO_COLOR: '1' }, colored: false },
  ])('keeps the Chinese Node warning on stderr with $name', async ({ env, colored }) => {
    const result = await runBootstrapFixture([
      '--input-type=module',
      '--eval',
      `
        const { runWeappViteCLI } = await import('./bin/bootstrap.js')
        await runWeappViteCLI({ argv: ['build'], nodeVersion: '20.19.0', importer: async () => {} })
      `,
    ], env)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('警告')
    expect(result.stderr).toContain('当前 Node.js 版本')
    expect(result.stderr).toContain('20.19.0')
    expect(result.stderr).toContain('推荐版本：')
    expect(result.stderr).toContain('为获得安全修复，建议升级至受支持 LTS 分支的最新补丁版本。')
    expect(result.stderr).toContain('本次将继续运行；若遇到依赖兼容问题，请先升级 Node.js。')
    expect(stripVTControlCharacters(result.stderr) !== result.stderr).toBe(colored)
  })
})
