import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { bindHostLifecycle } from './lifecycle'

it('waits for replacement startup and closes the replacement session before returning', async () => {
  const entered = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const closeReplacement = vi.fn(async () => {})
  const nativeClose = vi.fn(async () => {})
  const server = {
    close: nativeClose,
    restart: async () => {
      entered.resolve()
      await ready.promise
      server.close = closeReplacement
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  const restarting = server.restart()
  await entered.promise
  let closed = false
  const closing = server.close().then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closed).toBe(false)
  ready.resolve()
  await Promise.all([restarting, closing])
  expect(closeReplacement).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
})

it('cancels a queued restart once close begins and closes the native host once', async () => {
  const ready = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const nativeRestart = vi.fn(async () => {})
  const server = { close: nativeClose, restart: nativeRestart } as unknown as ViteDevServer
  bindHostLifecycle(server, () => ready.promise)
  const restarting = server.restart()
  const closing = server.close()
  ready.resolve()
  await Promise.all([restarting, closing, server.close()])
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(nativeClose).toHaveBeenCalledOnce()
})

it('keeps a replacement session alive and restarts it after its parent restart finishes', async () => {
  const ready = Promise.withResolvers<void>()
  const inheritedRestart = ready.promise
  const closeSession = vi.fn(async () => {})
  const rebuild = vi.fn(async (_force?: boolean) => {})
  const server = {
    _restartPromise: inheritedRestart as Promise<void> | null,
    close: vi.fn(async () => {}),
    restart: (force?: boolean) => server._restartPromise ?? rebuild(force),
  }
  bindHostLifecycle(server as unknown as ViteDevServer, closeSession)
  const restarting = server.restart(true)
  await Promise.resolve()
  expect(closeSession).not.toHaveBeenCalled()
  expect(rebuild).not.toHaveBeenCalled()
  server._restartPromise = null
  ready.resolve()
  await restarting
  expect(closeSession).toHaveBeenCalledOnce()
  expect(rebuild).toHaveBeenCalledExactlyOnceWith(true)
})

it('cancels a replacement restart on startup failure without waiting for the parent', async () => {
  const ready = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const nativeRestart = vi.fn(async () => {})
  const server = {
    _restartPromise: ready.promise,
    close: nativeClose,
    restart: nativeRestart,
  } as unknown as ViteDevServer
  const closeSession = vi.fn(async () => {})
  bindHostLifecycle(server, closeSession)
  const restarting = server.restart()
  // configureServer 失败时父重启还在等待新宿主初始化；关闭不能反向等待父重启。
  await server.close()
  await restarting
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(nativeClose).toHaveBeenCalledOnce()
  ready.resolve()
})
