import { describe, expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from './devBuildWatcher'

describe('devBuildWatcher', () => {
  it('forwards one-shot build events through the Rolldown watcher contract', () => {
    const controller = createDevBuildWatcher()
    const listener = vi.fn()

    controller.emitEvent({ code: 'START' })
    controller.emitEvent({ code: 'END' })
    controller.watcher.on('event', listener)

    expect(listener).toHaveBeenNthCalledWith(1, { code: 'START' })
    expect(listener).toHaveBeenNthCalledWith(2, { code: 'END' })
  })

  it('supports off, clear and idempotent close', async () => {
    const controller = createDevBuildWatcher()
    const eventListener = vi.fn()
    const closeListener = vi.fn()

    controller.watcher.on('event', eventListener)
    controller.watcher.off('event', eventListener)
    controller.emitEvent({ code: 'START' })
    controller.watcher.on('close', closeListener)
    await controller.watcher.close()
    await controller.watcher.close()

    expect(eventListener).not.toHaveBeenCalled()
    expect(closeListener).toHaveBeenCalledTimes(1)
  })

  it('discards queued events and refuses new subscriptions after close', async () => {
    const controller = createDevBuildWatcher()
    const eventListener = vi.fn()
    const closeListener = vi.fn()

    controller.emitEvent({ code: 'START' })
    controller.emitEvent({ code: 'END' })
    await controller.watcher.close()
    controller.watcher.on('event', eventListener)
    controller.watcher.on('close', closeListener)
    controller.emitEvent({ code: 'START' })
    await controller.watcher.close()

    expect(eventListener).not.toHaveBeenCalled()
    expect(closeListener).not.toHaveBeenCalled()
  })

  it('joins a pending close through the same promise', async () => {
    const controller = createDevBuildWatcher()
    const released = Promise.withResolvers<void>()
    const closeListener = vi.fn(() => released.promise)
    controller.watcher.on('close', closeListener)

    const closing = controller.watcher.close()
    expect(controller.watcher.close()).toBe(closing)
    let settled = false
    void closing.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    released.resolve()
    await closing
    expect(closeListener).toHaveBeenCalledOnce()
  })

  it('retains the same close failure for repeated callers', async () => {
    const controller = createDevBuildWatcher()
    const failure = new Error('controller cleanup failed')
    controller.watcher.on('close', () => {
      throw failure
    })

    const closing = controller.watcher.close()
    const outcome = closing.catch(error => error as unknown)
    expect(controller.watcher.close()).toBe(closing)
    expect(await outcome).toBe(failure)
    await expect(controller.watcher.close()).rejects.toBe(failure)
  })
})
