import { expect, it, vi } from 'vitest'

const runtimeLoaded = vi.hoisted(() => vi.fn())
vi.mock('@weapp-vite/miniprogram-automator', async (importOriginal) => {
  runtimeLoaded()
  return await importOriginal<typeof import('@weapp-vite/miniprogram-automator')>()
})

it('keeps synchronous CLI helpers usable before loading the automator for an operation', async () => {
  const cli = await import('../src/index')
  expect(cli.resolveProjectAutomatorPort('project')).toBeTypeOf('number')
  expect(cli.isAutomatorLoginError(new Error('need re-login'))).toBe(true)
  expect(cli.isAutomatorCommand('screenshot')).toBe(true)
  expect(runtimeLoaded).not.toHaveBeenCalled()

  const execute = vi.fn(async () => 'done')
  await expect(cli.runRetryableCommand({
    execute,
    createCancelError: () => new Error('cancelled'),
    isRetryableResult: () => false,
    promptRetry: async () => false,
    shouldRetry: () => false,
  })).resolves.toBe('done')
  expect(runtimeLoaded).not.toHaveBeenCalled()
  expect(execute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ signal: expect.any(AbortSignal) }))
})
