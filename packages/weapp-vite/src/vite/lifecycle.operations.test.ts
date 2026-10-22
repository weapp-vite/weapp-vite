import type { ViteDevServer } from 'vite'
import { AsyncLocalStorage } from 'node:async_hooks'
import { expect, it, vi } from 'vitest'
import { bindHostLifecycle } from './lifecycle'

it('does not let a callback captured by a completed restart bypass the next host exit gate', async () => {
  const entered = Promise.withResolvers<void>()
  const released = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  let invokeLate: (action: () => Promise<void>) => Promise<void> = action => action()
  let first: ViteDevServer
  let second: ViteDevServer
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      first = {
        config: { inlineConfig: server.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: async () => {
          second = {
            config: { inlineConfig: first.config.inlineConfig },
            close: nativeClose,
            restart: vi.fn(async () => {}),
          } as unknown as ViteDevServer
          bindHostLifecycle(second, async () => {})
          entered.resolve()
          await released.promise
          Object.assign(first, second)
        },
      } as unknown as ViteDevServer
      bindHostLifecycle(first, async () => {})
      invokeLate = AsyncLocalStorage.snapshot()
      Object.assign(server, first)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await server.restart()
  const restarting = first!.restart()
  await entered.promise
  let finished = false
  const closing = invokeLate(() => second!.close()).then(() => {
    finished = true
  })
  try {
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(finished).toBe(false)
    expect(nativeClose).not.toHaveBeenCalled()
  }
  finally {
    released.resolve()
    await Promise.all([restarting, closing])
  }
  expect(nativeClose).toHaveBeenCalledOnce()
})
