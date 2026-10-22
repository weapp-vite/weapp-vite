import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { bindHostLifecycle, setHostRestartData } from './lifecycle'

it('fully closes the captured host watcher before replacement config prepares across repeated restarts', async () => {
  const sessionReleased = Promise.withResolvers<void>()
  const watcherReleased = Promise.withResolvers<void>()
  const enteredWatcher = Promise.withResolvers<void>()
  const events: string[] = []
  const nextWatcherClose = vi.fn(async () => {
    events.push('next-watcher-closed')
  })
  const originalWatcherClose = vi.fn(async () => {
    events.push('old-watcher-closing')
    enteredWatcher.resolve()
    await watcherReleased.promise
    events.push('old-watcher-closed')
  })
  let generation = 0
  let active: ViteDevServer
  function createHost(): ViteDevServer {
    const host = {
      config: { inlineConfig: {} },
      watcher: { close: generation === 0 ? originalWatcherClose : nextWatcherClose },
      close: vi.fn(async () => {}),
      restart: async (force?: boolean) => {
        events.push(`replacement-config-${generation}:${force}`)
        generation++
        const replacement = createHost()
        replacement.config = { inlineConfig: host.config.inlineConfig } as ViteDevServer['config']
        bindHostLifecycle(replacement, async () => {
          events.push('next-session-closed')
        })
        active = replacement
        // 对齐 Vite：替换配置已准备后，原生宿主还会再次请求关闭旧 watcher。
        await host.watcher.close()
        Object.assign(host, replacement)
      },
    } as unknown as ViteDevServer
    return host
  }
  const server = createHost()
  active = server
  bindHostLifecycle(server, async () => {
    events.push('old-session-closing')
    await sessionReleased.promise
    events.push('old-session-closed')
  })
  const first = server.restart(true)
  await Promise.resolve()
  expect(originalWatcherClose).not.toHaveBeenCalled()
  sessionReleased.resolve()
  await enteredWatcher.promise
  expect(events).toEqual(['old-session-closing', 'old-session-closed', 'old-watcher-closing'])
  watcherReleased.resolve()
  await first
  expect(events).toEqual(['old-session-closing', 'old-session-closed', 'old-watcher-closing', 'old-watcher-closed', 'replacement-config-0:true'])
  await active.restart(false)
  expect(events.slice(-3)).toEqual(['next-session-closed', 'next-watcher-closed', 'replacement-config-1:false'])
  expect(originalWatcherClose).toHaveBeenCalledOnce()
  expect(nextWatcherClose).toHaveBeenCalledOnce()
  await active.close()
})

it('retains a watcher close failure and stops replacement preparation without reacquiring resources', async () => {
  const failure = new Error('host watcher close failed')
  const handoffFailure = new Error('handoff cleanup failed')
  const closeWatcher = vi.fn(async () => {
    throw failure
  })
  const restart = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, watcher: { close: closeWatcher }, close, restart } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, Symbol('held-handoff'), {}, async () => {
    throw handoffFailure
  })
  await expect(server.restart()).rejects.toMatchObject({ errors: [failure, handoffFailure], cause: failure })
  expect(restart).not.toHaveBeenCalled()
  await expect(server.restart()).rejects.toBe(failure)
  expect(closeWatcher).toHaveBeenCalledOnce()
  await expect(server.close()).rejects.toMatchObject({ errors: [failure, handoffFailure] })
  await expect(server.close()).rejects.toMatchObject({ errors: [failure, handoffFailure] })
  expect(close).toHaveBeenCalledOnce()
})

it('does not close the host watcher or prepare a replacement when the old session cannot close', async () => {
  const failure = new Error('session failed to close')
  const closeWatcher = vi.fn(async () => {})
  const restart = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, watcher: { close: closeWatcher }, close: vi.fn(async () => {}), restart } as unknown as ViteDevServer
  const closeSession = vi.fn(async () => {}).mockRejectedValueOnce(failure)
  bindHostLifecycle(server, closeSession)
  await expect(server.restart()).rejects.toBe(failure)
  expect(closeWatcher).not.toHaveBeenCalled()
  expect(restart).not.toHaveBeenCalled()
  await server.close()
})

it('cancels replacement preparation if shutdown begins while the exact watcher is closing', async () => {
  const released = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  const closeWatcher = vi.fn(async () => {
    entered.resolve()
    await released.promise
  })
  const restart = vi.fn(async () => {})
  const close = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, watcher: { close: closeWatcher }, close, restart } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  const restarting = server.restart()
  await entered.promise
  const closing = server.close()
  expect(close).not.toHaveBeenCalled()
  released.resolve()
  await Promise.all([restarting, closing, server.close()])
  expect(restart).not.toHaveBeenCalled()
  expect(closeWatcher).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
})
