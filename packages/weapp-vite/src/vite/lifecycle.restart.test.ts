import type { InlineConfig, ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { bindHostLifecycle, setHostRestartData, takeHostRestartData } from './lifecycle'

it('distinguishes restart handoff from terminal shutdown without changing the original error', async () => {
  const failure = new Error('native restart failed')
  const closeSession = vi.fn(async (_reason: 'restart' | 'close') => {})
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: vi.fn(async () => { throw failure }),
  } as unknown as ViteDevServer
  bindHostLifecycle(server, closeSession)
  await expect(server.restart()).rejects.toBe(failure)
  expect(closeSession.mock.calls).toEqual([['restart']])
  await server.close()
  expect(closeSession.mock.calls).toEqual([['restart'], ['close']])
})

it.each(['unchanged', 'config-only', 'bound'] as const)('rejects a resolved native restart without a committed replacement (%s)', async (replacementStage) => {
  const key = Symbol('profile')
  const dispose = vi.fn(async () => {})
  const closeSession = vi.fn(async () => {})
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  const replacementSession = vi.fn(async () => {})
  const logError = vi.fn()
  let replacement: ViteDevServer | undefined
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: vi.fn(async () => {
      if (replacementStage === 'config-only') {
        server.config = { ...server.config }
      }
      if (replacementStage === 'bound') {
        replacement = {
          config: { inlineConfig: server.config.inlineConfig },
          close: replacementClose,
          restart: vi.fn(async () => {}),
        } as unknown as ViteDevServer
        bindHostLifecycle(replacement, replacementSession)
      }
      // 与 Vite 一致：替换宿主初始化失败只记录错误并返回，不抛出。
      logError('replacement startup failed')
      logError('server restart failed')
    }),
  } as unknown as ViteDevServer
  const generation = getDevServerCloseRecord(server)
  const nativeRestart = server.restart
  bindHostLifecycle(server, closeSession)
  await setHostRestartData(server, key, {}, dispose)
  const restarting = server.restart()
  expect(server.restart()).toBe(restarting)
  await expect(restarting).rejects.toThrow('未完成替换宿主交接')
  expect(getDevServerCloseRecord(server)).toBe(generation)
  expect(nativeRestart).toHaveBeenCalledOnce()
  expect(closeSession).toHaveBeenCalledOnce()
  expect(logError).toHaveBeenCalledWith('replacement startup failed')
  expect(dispose).toHaveBeenCalledExactlyOnceWith('failed')
  if (replacement) {
    expect(getDevServerCloseRecord(replacement)).not.toBe(generation)
    expect(takeHostRestartData(replacement, key)).toBeUndefined()
    expect(replacementSession).toHaveBeenCalledOnce()
    expect(replacementClose).toHaveBeenCalledOnce()
  }
  await Promise.all([server.close(), server.close()])
  expect(nativeClose).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledTimes(replacement ? 1 : 0)
})

it('preserves restart failure while closing the exact uncommitted replacement', async () => {
  const failure = new Error('later configureServer failed')
  const cleanupFailure = new Error('replacement cleanup failed')
  const replacementClose = vi.fn(async () => {
    throw cleanupFailure
  })
  const replacementSession = vi.fn(async () => {})
  const dispose = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, replacementSession)
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, Symbol('profile'), {}, dispose)
  await expect(server.restart()).rejects.toMatchObject({ errors: [failure, cleanupFailure], cause: failure })
  expect(replacementSession).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledExactlyOnceWith('failed')
  await expect(server.close()).rejects.toBe(cleanupFailure)
  expect(replacementClose).toHaveBeenCalledOnce()
})

it('cancels a queued replacement restart while its failed parent releases it', async () => {
  const failure = new Error('later configureServer failed')
  const replacementRestart = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  let queuedRestart: Promise<void> | undefined
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: replacementRestart,
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      queuedRestart = replacement.restart()
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await expect(server.restart()).rejects.toBe(failure)
  await queuedRestart
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(replacementRestart).not.toHaveBeenCalled()
  await server.close()
})

it('releases a consumed handoff through the uncommitted replacement owner', async () => {
  const key = Symbol('snapshot')
  const failure = new Error('later configureServer failed')
  const release = vi.fn(async () => {})
  const disposeUnconsumed = vi.fn(async () => {})
  const snapshot = { release }
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      let adopted: typeof snapshot | undefined
      bindHostLifecycle(replacement, async () => {
        await adopted?.release()
      })
      adopted = takeHostRestartData(replacement, key)
      expect(adopted).toBe(snapshot)
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, key, snapshot, disposeUnconsumed)
  await expect(server.restart()).rejects.toBe(failure)
  expect(release).toHaveBeenCalledOnce()
  expect(disposeUnconsumed).not.toHaveBeenCalled()
  await server.close()
  expect(release).toHaveBeenCalledOnce()
})

it('accepts only the committed replacement generation and transfers its handoff once', async () => {
  const key = Symbol('profile')
  const value = {}
  const dispose = vi.fn(async () => {})
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  let replacement: ViteDevServer | undefined
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: vi.fn(async () => {
      replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      expect(takeHostRestartData(replacement, key)).toBe(value)
      expect(takeHostRestartData(replacement, key)).toBeUndefined()
      Object.assign(server, replacement)
    }),
  } as unknown as ViteDevServer
  const generation = getDevServerCloseRecord(server)
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, key, value, dispose)
  await expect(server.restart()).resolves.toBeUndefined()
  expect(getDevServerCloseRecord(server)).not.toBe(generation)
  expect(getDevServerCloseRecord(server)).toBe(getDevServerCloseRecord(replacement!))
  expect(dispose).not.toHaveBeenCalled()
  expect(replacementClose).not.toHaveBeenCalled()
  await Promise.all([server.close(), server.close()])
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
})

it('validates consecutive replacements through the native host redirecting proxy', async () => {
  const closes = [] as Array<ReturnType<typeof vi.fn<() => Promise<void>>>>
  function createHost(inlineConfig: InlineConfig): { native: ViteDevServer, redirect: (server: ViteDevServer) => void } {
    const close = vi.fn(async () => {})
    closes.push(close)
    let internal: ViteDevServer
    internal = {
      config: { inlineConfig },
      close,
      restart: async () => {
        const next = createHost(internal.config.inlineConfig)
        Object.assign(internal, next.native)
        next.redirect(internal)
      },
    } as unknown as ViteDevServer
    // configureServer 使用的代理在 Vite Object.assign 后继续指向实际活动宿主。
    const proxy = new Proxy(internal, {
      get: (_target, property) => Reflect.get(internal, property),
      set: (_target, property, value) => Reflect.set(internal, property, value),
    })
    bindHostLifecycle(proxy, async () => {})
    return { native: internal, redirect: server => internal = server }
  }
  const { native: server } = createHost({})
  for (let index = 0; index < 3; index++) {
    const generation = getDevServerCloseRecord(server)
    await expect(server.restart()).resolves.toBeUndefined()
    expect(getDevServerCloseRecord(server)).not.toBe(generation)
  }
  await server.close()
  expect(closes.at(-1)).toHaveBeenCalledOnce()
  expect(closes.slice(0, -1).every(close => close.mock.calls.length === 0)).toBe(true)
})
