/* eslint-disable e18e/ban-dependencies -- 验证官方 CLI 探针的参数和失败语义。 */
import { execa } from 'execa'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { diagnosePlatformRuntime } from './platform-runtime-doctor'

vi.mock('execa', () => ({ execa: vi.fn() }))
afterEach(() => vi.resetAllMocks())

describe('Alipay CLI capability probe', () => {
  it('recognizes minidev with its documented --vers option', async () => {
    vi.mocked(execa).mockImplementation(((_command: string, args: string[]) => Promise.resolve({
      exitCode: args.length === 1 && args[0] === '--vers' ? 0 : 1,
    })) as typeof execa)
    expect(await diagnosePlatformRuntime('alipay')).toMatchObject({ id: 'alipay', ready: true })
    expect(execa).toHaveBeenCalledWith('minidev', ['--vers'], expect.objectContaining({
      reject: false,
      timeout: 10_000,
    }))
  })

  it.each(['nonzero', 'missing'])('does not accept an unavailable CLI: %s', async (failure) => {
    if (failure === 'missing') {
      vi.mocked(execa).mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    }
    else {
      vi.mocked(execa).mockResolvedValueOnce({ exitCode: 1 } as Awaited<ReturnType<typeof execa>>)
    }
    expect(await diagnosePlatformRuntime('alipay')).toMatchObject({ id: 'alipay', ready: false })
  })
})
