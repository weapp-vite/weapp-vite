import { describe, expect, it, vi } from 'vitest'
import { formatPrepareSkipMessage, runWeappViteCLI } from './bootstrap.js'

describe('bin bootstrap', () => {
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
})
