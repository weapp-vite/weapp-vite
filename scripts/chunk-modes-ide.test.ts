import { afterEach, describe, expect, it, vi } from 'vitest'
import { openChunkModesIde, resolveChunkModesIdeCli } from './chunk-modes-ide.mjs'

const { execaMock } = vi.hoisted(() => ({ execaMock: vi.fn() }))
vi.mock('execa', () => ({ execa: execaMock }))
afterEach(() => vi.resetAllMocks())

describe('chunk modes IDE selection and ownership', () => {
  it('requires an explicit selected installation instead of falling back to global configuration', () => {
    expect(() => resolveChunkModesIdeCli({})).toThrow('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH')
    expect(() => resolveChunkModesIdeCli({ WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH: ' ' })).toThrow('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH')
    expect(execaMock).not.toHaveBeenCalled()
  })

  it('opens only the requested project through the selected CLI with a bounded lifetime', async () => {
    const cli = resolveChunkModesIdeCli({ WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH: ' selected stable cli ' })
    await openChunkModesIde('scenario project', cli)
    expect(execaMock).toHaveBeenCalledExactlyOnceWith('selected stable cli', ['open', '-p', 'scenario project'], {
      stdio: 'inherit',
      timeout: 120_000,
    })
  })

  it('propagates open failure without issuing close, quit, cache or fallback commands', async () => {
    const failure = new Error('selected CLI unavailable')
    execaMock.mockRejectedValueOnce(failure)
    await expect(openChunkModesIde('scenario project', 'selected-cli')).rejects.toBe(failure)
    expect(execaMock).toHaveBeenCalledTimes(1)
  })
})
