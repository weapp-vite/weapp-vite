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
  it('releases completed startup cancellation without closing the handed-off resource', async () => {
    const owner = createDevWatcherSession()
    const cancelReadiness = vi.fn(async () => {})
    const releaseReadiness = await owner.ownResource(cancelReadiness)
    releaseReadiness()
    releaseReadiness()
    const current = generation()
    await owner.own(current.watcher)
    await owner.close()
    expect(cancelReadiness).not.toHaveBeenCalled()
    expect(current.stopped).toHaveBeenCalledOnce()
  })

  it('cancels pending startup before joining its in-flight restart', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const entered = Promise.withResolvers<void>()
    const readiness = Promise.withResolvers<void>()
    const trace: string[] = []
    await owner.own(first.watcher)
    const restarting = owner.restart(async () => {
      await owner.stopGeneration(first.watcher)
      const releaseReadiness = await owner.ownResource(async () => {
        trace.push('cancel-readiness')
        readiness.resolve()
      })
      entered.resolve()
      try {
        await readiness.promise
        trace.push('startup-released')
      }
      finally {
        releaseReadiness()
      }
    })
    await entered.promise
    await first.watcher.close()
    await restarting
    expect(trace).toEqual(['cancel-readiness', 'startup-released'])
    expect(first.stopped).toHaveBeenCalledOnce()
  })

  it('retains session resources across generation stops and joins their final shutdown', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const next = generation()
    const release = Promise.withResolvers<void>()
    const closeResource = vi.fn(() => release.promise)
    await owner.ownResource(closeResource)
    await owner.own(first.watcher)
    await owner.restart(async () => {
      await owner.stopGeneration(first.watcher)
      await owner.own(next.watcher)
    })
    expect(closeResource).not.toHaveBeenCalled()
    const closing = first.watcher.close()
    expect(owner.close()).toBe(closing)
    let closed = false
    void closing.then(() => closed = true)
    await Promise.resolve()
    expect(closeResource).toHaveBeenCalledOnce()
    expect(closed).toBe(false)
    release.resolve()
    await closing
    expect(closed).toBe(true)
    expect(next.stopped).toHaveBeenCalledOnce()
    const lateResource = vi.fn(async () => {})
    await owner.ownResource(lateResource)
    expect(lateResource).toHaveBeenCalledOnce()
  })

  it('retains session resource failures while still draining every generation', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const failure = new Error('session config watcher close failed')
    const closeResource = vi.fn(async () => {
      throw failure
    })
    await owner.own(first.watcher)
    await owner.ownResource(closeResource)
    const closing = owner.close()
    await expect(closing).rejects.toBe(failure)
    expect(owner.close()).toBe(closing)
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(closeResource).toHaveBeenCalledOnce()
  })

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

  it('retains a settled restart failure through the original idempotent close handle', async () => {
    const owner = createDevWatcherSession()
    const first = generation()
    const replacement = generation()
    const failure = new Error('replacement startup failed')
    await owner.own(first.watcher)
    await owner.restart(async () => {
      await owner.stopGeneration(first.watcher)
      await owner.own(replacement.watcher)
    })
    await expect(owner.restart(async () => {
      throw failure
    })).rejects.toBe(failure)
    const closing = first.watcher.close()
    expect(first.watcher.close()).toBe(closing)
    expect(replacement.watcher.close()).toBe(closing)
    await expect(closing).rejects.toBe(failure)
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(replacement.stopped).toHaveBeenCalledOnce()
    const other = createDevWatcherSession()
    const unrelated = generation()
    await other.own(unrelated.watcher)
    await expect(unrelated.watcher.close()).resolves.toBeUndefined()
  })
})
