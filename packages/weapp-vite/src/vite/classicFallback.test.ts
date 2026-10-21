import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { createHmrRuntimeSession } from '../runtime/hmrRuntimeSession'
import { bindClassicFallback, rethrowAfterHostCleanup } from './classicFallback'

const unsupported = { code: 'config-json', message: '当前变化不能保持状态' } as const

it('keeps the primary error after successful cleanup and retains any independent cleanup failure', async () => {
  const primary = new Error('configuration failed')
  const cleanup = vi.fn(async () => {})
  await expect(rethrowAfterHostCleanup(primary, cleanup)).rejects.toBe(primary)
  expect(cleanup).toHaveBeenCalledOnce()
  const cleanupFailure = new Error('compiler cleanup failed')
  await expect(rethrowAfterHostCleanup(primary, async () => {
    throw cleanupFailure
  }))
    .rejects
    .toMatchObject({ errors: [primary, cleanupFailure], cause: primary })
  await expect(rethrowAfterHostCleanup(primary, async () => {
    throw primary
  })).rejects.toBe(primary)
})

it('publishes the request without waiting for its own close and restarts the host only once', async () => {
  const runtime = createHmrRuntimeSession()
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const server = {
    config: { logger: { warn: vi.fn(), error: vi.fn() } },
    close: vi.fn(async () => {}),
    restart: vi.fn(async () => {
      entered.resolve()
      await released.promise
      runtime.markClassic()
    }),
  } as unknown as ViteDevServer
  const release = bindClassicFallback(server, runtime)
  runtime.requestClassic(unsupported)
  runtime.requestClassic({ ...unsupported, message: '下一次保存' })
  expect(runtime.phase).toBe('switching')
  expect(server.restart).not.toHaveBeenCalled()
  await entered.promise
  expect(server.restart).toHaveBeenCalledOnce()
  released.resolve()
  await runtime.whenSettled()
  expect(runtime.phase).toBe('classic')
  expect(server.close).not.toHaveBeenCalled()
  release()
  release()
})

it('stops the host on failed transition, retaining both restart and cleanup failures', async () => {
  const failure = new Error('replacement compiler failed')
  const cleanup = new Error('native host cleanup failed')
  const runtime = createHmrRuntimeSession()
  const server = {
    config: { logger: { warn: vi.fn(), error: vi.fn() } },
    close: vi.fn(async () => {
      throw cleanup
    }),
    restart: vi.fn(async () => {
      throw failure
    }),
  } as unknown as ViteDevServer
  bindClassicFallback(server, runtime)
  runtime.requestClassic(unsupported)
  await expect(runtime.whenSettled()).rejects.toMatchObject({ errors: [failure, cleanup], cause: failure })
  runtime.requestClassic(unsupported)
  await expect(runtime.whenSettled()).rejects.toMatchObject({ cause: failure })
  expect(server.restart).toHaveBeenCalledOnce()
  expect(server.close).toHaveBeenCalledOnce()
})

it('wraps a non-Error host failure before reporting it and stopping the transition', async () => {
  const runtime = createHmrRuntimeSession()
  const server = {
    config: { logger: { error: vi.fn() } },
    close: vi.fn(async () => {}),
    restart: vi.fn<() => Promise<void>>().mockRejectedValue('replacement rejected without an Error'),
  } as unknown as ViteDevServer
  bindClassicFallback(server, runtime)
  runtime.requestClassic(unsupported)
  await expect(runtime.whenSettled()).rejects.toThrow('replacement rejected without an Error')
  expect(server.config.logger.error).toHaveBeenCalledWith(expect.any(String), { error: expect.any(Error) })
  expect(server.close).toHaveBeenCalledOnce()
})

it('lets a closed generation release an unhandled request before the next owner binds', async () => {
  const runtime = createHmrRuntimeSession()
  const old = { config: { logger: { warn: vi.fn(), error: vi.fn() } }, close: vi.fn(async () => {}), restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  const release = bindClassicFallback(old, runtime)
  release()
  runtime.requestClassic(unsupported)
  await Promise.resolve()
  expect(old.restart).not.toHaveBeenCalled()
  const replacement = {
    config: old.config,
    close: vi.fn(async () => {}),
    restart: vi.fn(async () => {
      runtime.markClassic()
    }),
  } as unknown as ViteDevServer
  bindClassicFallback(replacement, runtime)
  await runtime.whenSettled()
  expect(replacement.restart).toHaveBeenCalledOnce()
  expect(runtime.phase).toBe('classic')
})
