import type { ViteDevServer } from 'vite'
import { expect, it, vi } from 'vitest'
import { getDevServerCloseRecord } from '../devLifecycle/server'
import { bindHostLifecycle } from './lifecycle'

it.each([false, true])('waits for an uncommitted replacement when it receives terminal close (reloaded=%s)', async (reloaded) => {
  let bindReplacement = bindHostLifecycle
  if (reloaded) {
    vi.resetModules()
    bindReplacement = (await import('./lifecycle')).bindHostLifecycle
  }
  const prepared = Promise.withResolvers<ViteDevServer>()
  const handoff = Promise.withResolvers<void>()
  const finalizing = Promise.withResolvers<void>()
  const restored = Promise.withResolvers<void>()
  const nativeClose = vi.fn(async () => {})
  const replacementClose = vi.fn(async () => {})
  const replacementSession = vi.fn(async () => {})
  const finalize = vi.fn(async () => {
    finalizing.resolve()
    await restored.promise
  })
  const server = {
    config: { inlineConfig: {} },
    close: nativeClose,
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindReplacement(replacement, replacementSession)
      prepared.resolve(replacement)
      await handoff.promise
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {}, undefined, undefined, finalize)
  const restarting = server.restart()
  const replacement = await prepared.promise
  const exited = vi.fn()
  const closing = replacement.close().then(exited)
  const repeated = replacement.close()
  const originalClosing = server.close()
  try {
    await Promise.resolve()
    expect(exited).not.toHaveBeenCalled()
    expect(replacementClose).not.toHaveBeenCalled()
    expect(finalize).not.toHaveBeenCalled()
    handoff.resolve()
    await finalizing.promise
    expect(exited).not.toHaveBeenCalled()
    expect(replacementClose).toHaveBeenCalledOnce()
    expect(replacementSession).toHaveBeenCalledOnce()
  }
  finally {
    handoff.resolve()
    restored.resolve()
    await Promise.all([restarting, closing, repeated, originalClosing])
  }
  await Promise.all([server.close(), replacement.close()])
  expect(exited).toHaveBeenCalledOnce()
  expect(finalize).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(nativeClose).not.toHaveBeenCalled()
})

it.each([false, true])('keeps external terminal waiting separate from failed initialization cleanup (cleanupFails=%s)', async (cleanupFails) => {
  const failure = new Error('replacement initialization failed')
  const cleanupFailure = new Error('replacement cleanup failed')
  const prepared = Promise.withResolvers<ViteDevServer>()
  const fail = Promise.withResolvers<void>()
  const replacementClose = vi.fn(async () => {
    if (cleanupFails) {
      throw cleanupFailure
    }
  })
  const finalizeReplacement = vi.fn(async () => {})
  const finalizeParent = vi.fn(async () => {})
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {}, undefined, undefined, finalizeReplacement)
      prepared.resolve(replacement)
      await fail.promise
      // 初始化内部必须能独立完成本代清理，不能复用外部等待父重启的 Promise。
      if (cleanupFails) {
        await expect(replacement.close()).rejects.toBe(cleanupFailure)
      }
      else {
        await replacement.close()
      }
      throw failure
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {}, undefined, undefined, finalizeParent)
  const restarting = server.restart()
  const replacement = await prepared.promise
  const closing = replacement.close()
  const outcomes = Promise.allSettled([restarting, closing])
  try {
    await Promise.resolve()
    expect(replacementClose).not.toHaveBeenCalled()
  }
  finally {
    fail.resolve()
    await outcomes
  }
  const [restartResult, closeResult] = await outcomes
  expect(restartResult).toMatchObject({ status: 'rejected' })
  expect(closeResult).toMatchObject({ status: 'rejected' })
  if (restartResult.status === 'rejected' && closeResult.status === 'rejected') {
    if (cleanupFails) {
      expect(restartResult.reason).toMatchObject({ errors: [failure, cleanupFailure], cause: failure })
    }
    else {
      expect(restartResult.reason).toBe(failure)
    }
    expect(closeResult.reason).toBe(restartResult.reason)
    await expect(server.close()).rejects.toBe(restartResult.reason)
  }
  expect(replacementClose).toHaveBeenCalledOnce()
  expect(finalizeReplacement).not.toHaveBeenCalled()
  expect(finalizeParent).toHaveBeenCalledTimes(cleanupFails ? 0 : 1)
})

it('expires inherited native restart permissions in callbacks that outlive the handoff', async () => {
  const trigger = Promise.withResolvers<void>()
  const finalizeParent = vi.fn(async () => {})
  const closeParentSession = vi.fn(async (_reason: 'restart' | 'close') => {})
  const replacementClose = vi.fn(async () => {})
  let delayedClose: Promise<void> | undefined
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      // 回调在 nativeRestart 的上下文中登记，但实际执行时该次内部操作已结束。
      delayedClose = trigger.promise.then(() => replacement.close())
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, closeParentSession, undefined, undefined, finalizeParent)
  await server.restart()
  trigger.resolve()
  await delayedClose
  expect(closeParentSession.mock.calls).toEqual([['restart'], ['close']])
  expect(finalizeParent).toHaveBeenCalledOnce()
  expect(replacementClose).toHaveBeenCalledOnce()
  await server.close()
  expect(finalizeParent).toHaveBeenCalledOnce()
})

it('does not give an independent host internal cleanup permission from another host restart', async () => {
  const prepared = Promise.withResolvers<ViteDevServer>()
  const release = Promise.withResolvers<void>()
  const independentFinalize = vi.fn(async () => {})
  const independent = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: independent.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      Object.assign(independent, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(independent, async () => {}, undefined, undefined, independentFinalize)
  await independent.restart()
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      await independent.close()
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: vi.fn(async () => {}),
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      bindHostLifecycle(replacement, async () => {})
      prepared.resolve(replacement)
      await release.promise
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {})
  const restarting = server.restart()
  await prepared.promise
  try {
    expect(independentFinalize).toHaveBeenCalledOnce()
  }
  finally {
    release.resolve()
    await restarting
    await Promise.all([server.close(), independent.close()])
  }
})

it('keeps an existing command shutdown gate outside the inherited terminal barrier', async () => {
  const finalizing = Promise.withResolvers<void>()
  const commandReleased = Promise.withResolvers<void>()
  const replacementClose = vi.fn(async () => {})
  const commandGate = vi.fn(async (close: () => Promise<void>) => {
    await close()
    await commandReleased.promise
  })
  const server = {
    config: { inlineConfig: {} },
    close: vi.fn(async () => {}),
    restart: async () => {
      const replacement = {
        config: { inlineConfig: server.config.inlineConfig },
        close: replacementClose,
        restart: vi.fn(async () => {}),
      } as unknown as ViteDevServer
      getDevServerCloseRecord(replacement).gate = commandGate
      bindHostLifecycle(replacement, async () => {})
      Object.assign(server, replacement)
    },
  } as unknown as ViteDevServer
  bindHostLifecycle(server, async () => {}, undefined, undefined, async () => finalizing.resolve())
  await server.restart()
  const exited = vi.fn()
  const closing = server.close().then(exited)
  try {
    await finalizing.promise
    expect(replacementClose).toHaveBeenCalledOnce()
    expect(commandGate).toHaveBeenCalledOnce()
    expect(exited).not.toHaveBeenCalled()
  }
  finally {
    commandReleased.resolve()
    await closing
  }
  expect(exited).toHaveBeenCalledOnce()
})
