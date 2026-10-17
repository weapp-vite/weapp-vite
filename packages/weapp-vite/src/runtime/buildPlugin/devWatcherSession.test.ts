import { describe, expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from './devBuildWatcher'
import { createDevWatcherSession } from './devWatcherSession'

function generation() {
  const { watcher } = createDevBuildWatcher()
  const stopped = vi.fn(async () => {})
  watcher.on('close', stopped)
  return { watcher, stopped }
}

describe('classic development watcher session', () => {
  it('closes the current provider through the earliest handle after multiple generations', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const second = generation()
    const third = generation()
    const manual = generation()
    await owner.own(first.watcher)
    await owner.restart(async () => {
      await owner.stopGeneration(first.watcher)
      await owner.own(second.watcher)
    })
    await owner.restart(async () => {
      await owner.stopGeneration(second.watcher)
      await owner.own(third.watcher)
    })
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(second.stopped).toHaveBeenCalledOnce()
    expect(third.stopped).not.toHaveBeenCalled()
    const closing = first.watcher.close()
    expect(first.watcher.close()).toBe(closing)
    expect(third.watcher.close()).toBe(closing)
    await closing
    expect(third.stopped).toHaveBeenCalledOnce()
    expect(manual.stopped).not.toHaveBeenCalled()
    expect(owner.hasOwnership).toBe(true)
    expect(owner.isClosing).toBe(true)
  })

  it('waits for and releases a replacement provider registered during close', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const replacement = generation()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const trace: string[] = []
    await owner.own(first.watcher)
    const restarting = owner.restart(async () => {
      await owner.stopGeneration(first.watcher)
      entered.resolve()
      await release.promise
      await owner.own(replacement.watcher)
      trace.push('replacement-stopped')
    })
    await entered.promise
    const closing = first.watcher.close().then(() => trace.push('closed'))
    release.resolve()
    await Promise.all([restarting, closing])
    expect(trace).toEqual(['replacement-stopped', 'closed'])
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(replacement.stopped).toHaveBeenCalledOnce()
  })

  it('cancels a registered restart before it begins when the caller closes', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    await owner.own(first.watcher)
    const run = vi.fn(async () => {})
    const restarting = owner.restart(run)
    await Promise.all([first.watcher.close(), restarting])
    expect(run).not.toHaveBeenCalled()
    expect(first.stopped).toHaveBeenCalledOnce()
  })

  it('preserves a restart failure while stopping every owned provider', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const second = generation()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const restartError = new Error('config reload failed')
    await owner.own(first.watcher)
    await owner.own(second.watcher)
    const restarting = owner.restart(async () => {
      entered.resolve()
      await release.promise
      throw restartError
    })
    const rejectedRestart = expect(restarting).rejects.toBe(restartError)
    await entered.promise
    const closing = first.watcher.close()
    const rejectedClose = expect(closing).rejects.toBe(restartError)
    release.resolve()
    await Promise.all([rejectedRestart, rejectedClose])
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(second.stopped).toHaveBeenCalledOnce()
    expect(first.watcher.close()).toBe(closing)
  })

  it('keeps shutdown and restart failures while still stopping the other provider', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const second = generation()
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const closeError = new Error('provider close failed')
    const restartError = new Error('config reload failed')
    first.stopped.mockRejectedValue(closeError)
    await owner.own(first.watcher)
    await owner.own(second.watcher)
    const restarting = owner.restart(async () => {
      entered.resolve()
      await release.promise
      throw restartError
    })
    const rejectedRestart = expect(restarting).rejects.toBe(restartError)
    await entered.promise
    const closing = first.watcher.close()
    const rejectedClose = expect(closing).rejects.toMatchObject({ errors: [closeError, restartError] })
    release.resolve()
    await Promise.all([rejectedRestart, rejectedClose])
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(second.stopped).toHaveBeenCalledOnce()
  })
})
