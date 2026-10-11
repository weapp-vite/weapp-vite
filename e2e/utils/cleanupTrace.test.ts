import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { traceCleanupStage } from './cleanupTrace'

describe('cleanup phase diagnostics', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each([
    { platform: 'win32', configured: undefined, defaultOnWindows: true, expected: true },
    { platform: 'linux', configured: undefined, defaultOnWindows: true, expected: false },
    { platform: 'win32', configured: undefined, defaultOnWindows: false, expected: false },
    { platform: 'win32', configured: '0', defaultOnWindows: true, expected: false },
    { platform: 'linux', configured: '1', defaultOnWindows: false, expected: true },
  ] as const)('selects phase output for $platform with opt-in $configured and default $defaultOnWindows', async ({ platform, configured, defaultOnWindows, expected }) => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', configured)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const result = Promise.resolve({ released: true })
    const operation = vi.fn(() => result)
    const pending = traceCleanupStage('dev-capture', operation, { defaultOnWindows })
    if (!expected) {
      expect(pending).toBe(result)
    }
    expect(await pending).toEqual({ released: true })
    expect(operation).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledTimes(expected ? 2 : 0)
  })

  it('emits a start before a pending operation and preserves an incomplete wait result', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '1')
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    let finish!: (value: boolean) => void
    const pending = traceCleanupStage('dev-owned-exit', () => new Promise<boolean>((resolve) => {
      finish = resolve
    }), { timeoutMs: 5_000, processCount: 2 })
    expect(write).toHaveBeenCalledOnce()
    const begin = JSON.parse(String(write.mock.calls[0]![0]).replace('[e2e-cleanup] ', '')) as Record<string, unknown>
    expect(begin).toMatchObject({ stage: 'dev-owned-exit', event: 'begin', timeoutMs: 5_000, processCount: 2 })
    finish(false)
    expect(await pending).toBe(false)
    const end = JSON.parse(String(write.mock.calls[1]![0]).replace('[e2e-cleanup] ', '')) as Record<string, unknown>
    expect(end).toMatchObject({ id: begin.id, stage: begin.stage, event: 'end', completed: false })
    expect(end.elapsedMs).toEqual(expect.any(Number))
  })

  it('retains the original rejection without logging error details or retrying', async () => {
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '1')
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const original = new Error('sensitive-command-payload')
    const operation = vi.fn(async () => {
      throw original
    })
    await expect(traceCleanupStage('dev-capture', operation)).rejects.toBe(original)
    expect(operation).toHaveBeenCalledOnce()
    expect(String(write.mock.calls[1]![0])).toContain('"event":"error"')
    expect(write.mock.calls.flat().join('')).not.toContain(original.message)
  })

  it('keeps a synchronous operation failure when diagnostic output also throws', () => {
    vi.stubEnv('WEAPP_VITE_E2E_CLEANUP_TRACE', '1')
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('diagnostic output unavailable')
    })
    const original = new Error('cleanup failed')
    const operation = vi.fn(() => {
      throw original
    })
    expect(() => traceCleanupStage('dev-capture', operation)).toThrow(original)
    expect(operation).toHaveBeenCalledOnce()
  })
})
