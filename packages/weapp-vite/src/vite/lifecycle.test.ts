import type { ViteDevServer } from 'vite'
import { mergeConfig } from 'vite'
import { expect, it, vi } from 'vitest'
import { bindHostLifecycle, setHostRestartData, takeHostRestartData } from './lifecycle'

it('waits for replacement startup and closes the replacement session before returning', async () => {
  const entered = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const closeReplacement = vi.fn(async () => {})
  const nativeClose = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
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
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: nativeRestart } as unknown as ViteDevServer
  bindHostLifecycle(server, () => ready.promise)
  const restarting = server.restart()
  const closing = server.close()
  ready.resolve()
  await Promise.all([restarting, closing, server.close()])
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(nativeClose).toHaveBeenCalledOnce()
})

it.each([false, true])('hands off a parent restart through native inline config (force: %s)', async (force) => {
  const entered = Promise.withResolvers<void>()
  const ready = Promise.withResolvers<void>()
  const closeSession = vi.fn(async () => {})
  const rebuild = vi.fn(async (_force?: boolean) => {})
  const originalConfig = Object.freeze({})
  const originalHostConfig = Object.freeze({ inlineConfig: originalConfig })
  let replacement: ViteDevServer
  const parent = {
    config: originalHostConfig,
    close: vi.fn(async () => {}),
    restart: async (force?: boolean) => {
      // 与 Vite 一致：父 _restartPromise 尚未赋值就同步创建替换宿主。
      replacement = {
        _restartPromise: null,
        config: { inlineConfig: force ? mergeConfig(parent.config.inlineConfig, { forceOptimizeDeps: true }) : parent.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: rebuild,
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, closeSession)
      entered.resolve()
      await ready.promise
      // 原生交接完成后，旧重启的 finally 不能把新一代配置恢复成旧配置。
      parent.config = replacement.config
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(parent, async () => {})
  const parentRestart = parent.restart(force)
  await entered.promise
  const restarting = replacement!.restart(true)
  await Promise.resolve()
  expect(closeSession).not.toHaveBeenCalled()
  expect(rebuild).not.toHaveBeenCalled()
  const independentClose = vi.fn(async () => {})
  const independent = {
    config: { inlineConfig: originalConfig },
    close: vi.fn(async () => {}),
    restart: vi.fn(async () => {}),
  } as unknown as ViteDevServer
  bindHostLifecycle(independent, independentClose)
  await independent.restart()
  expect(independentClose).toHaveBeenCalledOnce()
  expect(Reflect.ownKeys(originalConfig)).toEqual([])
  ready.resolve()
  await Promise.all([parentRestart, restarting])
  expect(closeSession).toHaveBeenCalledOnce()
  expect(rebuild).toHaveBeenCalledExactlyOnceWith(true)
  expect(parent.config).toBe(replacement!.config)
  expect(originalHostConfig.inlineConfig).toBe(originalConfig)
})

it('restores the original readonly config when native restart fails before handoff', async () => {
  const originalHostConfig = Object.freeze({ inlineConfig: Object.freeze({}) })
  const failure = new Error('replacement startup failed')
  const server = {
    config: originalHostConfig,
    close: vi.fn(async () => {}),
    restart: async () => {
      expect(server.config).not.toBe(originalHostConfig)
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await expect(server.restart()).rejects.toBe(failure)
  expect(server.config).toBe(originalHostConfig)
})

it('cancels a replacement restart on startup failure without waiting for the parent', async () => {
  const nativeClose = vi.fn(async () => {})
  const nativeRestart = vi.fn(async () => {})
  const closeSession = vi.fn(async () => {})
  const parent = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const server = {
        config: { inlineConfig: parent.config.inlineConfig },
        close: nativeClose,
        restart: nativeRestart,
      } as unknown as ViteDevServer
      bindHostLifecycle(server, closeSession)
      const restarting = server.restart()
      // configureServer 失败时父重启还在等待新宿主初始化；关闭不能反向等待父重启。
      await server.close()
      await restarting
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(parent, async () => {})
  await parent.restart()
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(nativeClose).toHaveBeenCalledOnce()
})

it('hands off data once and keeps a replacement generation separate from its parent', async () => {
  const key = Symbol('snapshot')
  const first = { value: 'first' }
  const second = { value: 'second' }
  let replacement: ViteDevServer
  let next: ViteDevServer
  const parent = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      replacement = {
        config: { inlineConfig: parent.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: async () => {
          next = { config: { inlineConfig: replacement.config.inlineConfig }, close: vi.fn(async () => {}), restart: vi.fn(async () => {}) } as unknown as ViteDevServer
          bindHostLifecycle(next, async () => {})
          expect(takeHostRestartData(next, key)).toBe(second)
          expect(takeHostRestartData(next, key)).toBeUndefined()
        },
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      expect(takeHostRestartData(replacement, key)).toBe(first)
      expect(takeHostRestartData(replacement, key)).toBeUndefined()
      setHostRestartData(replacement, key, second)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(parent, async () => {})
  setHostRestartData(parent, key, first)
  await parent.restart()
  await replacement!.restart()
  await next!.close()
})

it('releases unconsumed restart data on close and failed replacement startup', async () => {
  const key = Symbol('snapshot')
  let replacement: ViteDevServer
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      replacement = { config: { inlineConfig: server.config.inlineConfig }, close: vi.fn(async () => {}), restart: vi.fn(async () => {}) } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      throw new Error('startup failed')
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  setHostRestartData(server, key, { value: 'retired' })
  await expect(server.restart()).rejects.toThrow('startup failed')
  expect(takeHostRestartData(replacement!, key)).toBeUndefined()
  await Promise.all([server.close(), server.close(), replacement!.close()])
})

it('waits for abandoned data to flush while closing its original session in parallel', async () => {
  const flushed = Promise.withResolvers<void>()
  const closeSession = vi.fn(async () => {})
  const dispose = vi.fn(async () => {
    await flushed.promise
  })
  const server = { config: { inlineConfig: {} }, close: vi.fn(async () => {}), restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  bindHostLifecycle(server, closeSession)
  await setHostRestartData(server, Symbol('profile'), {}, dispose)
  let closed = false
  const closing = server.close().then(() => {
    closed = true
  })
  await Promise.resolve()
  expect(closeSession).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledExactlyOnceWith('incomplete')
  expect(closed).toBe(false)
  flushed.resolve()
  await Promise.all([closing, server.close()])
  expect(dispose).toHaveBeenCalledOnce()
})

it('preserves restart failure and awaits the failed handoff sink', async () => {
  const entered = Promise.withResolvers<void>()
  const flushed = Promise.withResolvers<void>()
  const failure = new Error('native replacement failed')
  const dispose = vi.fn(async () => {
    entered.resolve()
    await flushed.promise
  })
  const server = { config: { inlineConfig: {} }, close: vi.fn(async () => {}), restart: vi.fn(async () => {
    throw failure
  }) } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, Symbol('profile'), {}, dispose)
  let settled = false
  const restarting = server.restart().finally(() => {
    settled = true
  })
  const rejected = expect(restarting).rejects.toBe(failure)
  await entered.promise
  expect(settled).toBe(false)
  expect(dispose).toHaveBeenCalledExactlyOnceWith('failed')
  flushed.resolve()
  await rejected
  await server.close()
  expect(dispose).toHaveBeenCalledOnce()
})

it('retains both the native failure and a failed handoff cleanup', async () => {
  const failure = new Error('native replacement failed')
  const cleanup = new Error('handoff cleanup failed')
  const server = { config: { inlineConfig: {} }, close: vi.fn(async () => {}), restart: vi.fn(async () => {
    throw failure
  }) } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, Symbol('profile'), {}, async () => {
    throw cleanup
  })
  await expect(server.restart()).rejects.toMatchObject({ errors: [failure, cleanup], cause: failure })
  await server.close()
})

it('releases the handoff as failed when closing the original session fails before native restart', async () => {
  const failure = new Error('old session close failed')
  const dispose = vi.fn(async () => {})
  const nativeRestart = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, close: vi.fn(async () => {}), restart: nativeRestart } as unknown as ViteDevServer
  const closeSession = vi.fn(async () => {}).mockRejectedValueOnce(failure)
  bindHostLifecycle(server, closeSession)
  await setHostRestartData(server, Symbol('profile'), {}, dispose)
  await expect(server.restart()).rejects.toBe(failure)
  expect(nativeRestart).not.toHaveBeenCalled()
  expect(dispose).toHaveBeenCalledExactlyOnceWith('failed')
  await server.close()
  expect(dispose).toHaveBeenCalledOnce()
})

it('awaits all handoff sinks after one cleanup fails before closing the native host', async () => {
  const failure = new Error('first sink failed')
  const entered = Promise.withResolvers<void>()
  const flushed = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  await setHostRestartData(server, Symbol('failed'), {}, async () => {
    throw failure
  })
  await setHostRestartData(server, Symbol('flushing'), {}, async () => {
    entered.resolve()
    await flushed.promise
  })
  const closing = expect(server.close()).rejects.toBe(failure)
  await entered.promise
  await Promise.resolve()
  expect(nativeClose).not.toHaveBeenCalled()
  flushed.resolve()
  await closing
  expect(nativeClose).toHaveBeenCalledOnce()
})

it('flushes abandoned data even when closing the original session throws synchronously', async () => {
  const failure = new Error('synchronous close failure')
  const flushed = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const dispose = vi.fn(async () => {
    await flushed.promise
  })
  const server = { config: { inlineConfig: {} }, close: nativeClose, restart: vi.fn(async () => {}) } as unknown as ViteDevServer
  bindHostLifecycle(server, () => {
    throw failure
  })
  await setHostRestartData(server, Symbol('profile'), {}, dispose)
  const closing = expect(server.close()).rejects.toBe(failure)
  await Promise.resolve()
  expect(dispose).toHaveBeenCalledExactlyOnceWith('incomplete')
  expect(nativeClose).not.toHaveBeenCalled()
  flushed.resolve()
  await closing
  expect(nativeClose).toHaveBeenCalledOnce()
})
