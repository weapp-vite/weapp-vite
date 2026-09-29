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
