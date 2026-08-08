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
})
