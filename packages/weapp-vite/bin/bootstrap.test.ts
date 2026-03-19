import { describe, expect, it, vi } from 'vitest'
import { formatPrepareSkipMessage, guardPrepareProcessExit, runWeappViteCLI } from './bootstrap.js'

describe('bin bootstrap', () => {
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
})
