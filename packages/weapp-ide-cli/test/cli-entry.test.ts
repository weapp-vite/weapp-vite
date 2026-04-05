import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('../src/cli/index', () => ({
  parse: parseMock,
}))

vi.mock('../src/logger', () => ({
  default: loggerMock,
}))

describe('cli entry', () => {
  beforeEach(() => {
    vi.resetModules()
    parseMock.mockReset()
    loggerMock.error.mockReset()
    process.exitCode = undefined
  })

  it('waits for parse to finish before resolving module evaluation', async () => {
    let parseResolved = false
    parseMock.mockReturnValueOnce(new Promise<void>((resolve) => {
      setTimeout(() => {
        parseResolved = true
        resolve()
      }, 0)
    }))

    await import('../src/cli.ts?case=awaits')

    expect(parseMock).toHaveBeenCalled()
    expect(parseResolved).toBe(true)
  })

  it('maps parse exitCode errors to process.exitCode', async () => {
    parseMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { exitCode: 3 }))

    await import('../src/cli.ts?case=exit-code')

    expect(loggerMock.error).toHaveBeenCalled()
    expect(process.exitCode).toBe(3)
  })
})
