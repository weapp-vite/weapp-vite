import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, deferWatcherResourceCleanup, retainWatcherService } from '../watcherPlugin'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return { context, service: context.watcherService! }
}

describe('watcher service close ownership', () => {
  it('separates an internal final owner release from external callers of the same release', async () => {
    const { context, service } = createService()
    const release = retainWatcherService(service)
    const resources = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const sidecarStarted = Promise.withResolvers<void>()
    const cleanup = vi.fn(() => resources.promise)
    const webClose = vi.fn(() => web.promise)
    const sidecarClose = vi.fn(async () => {
      sidecarStarted.resolve()
    })
    const controllerClose = vi.fn(() => release())
    deferWatcherResourceCleanup(service, cleanup)
    context.webService = { close: webClose } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({ close: controllerClose })
    service.sidecarWatcherMap.set('sidecar', { close: sidecarClose })

    const closing = service.closeAll()
    expect(service.closeAll()).toBe(closing)
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
    let externalFinished = false
    const external = release().then(() => {
      externalFinished = true
    })
    resources.resolve()
    await controllerClose.mock.results[0]!.value
    await sidecarStarted.promise
    expect(externalFinished).toBe(false)
    expect(webClose).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    web.resolve()
    await Promise.all([closing, external])
    await release()
    expect(externalFinished).toBe(true)
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
  }, 5000)

  it('allows an owner-first release to reenter through its controller without awaiting itself', async () => {
    const { service } = createService()
    const release = retainWatcherService(service)
    const cleanup = vi.fn(async () => {})
    const controllerClose = vi.fn(async () => {
      await Promise.resolve()
      await release()
    })
    deferWatcherResourceCleanup(service, cleanup)
    service.setRollupWatcher({ close: controllerClose })

    await release()
    await service.closeAll()
    await release()
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
  }, 5000)

  it.each([false, true])('keeps an external release waiting for the active drain and its web failure: separate owner %s', async (separateOwner) => {
    const { context, service } = createService()
    const controllerRelease = retainWatcherService(service)
    const externalRelease = separateOwner ? retainWatcherService(service) : controllerRelease
    const controller = Promise.withResolvers<void>()
    const controllerReleased = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const failure = new Error('web close failed')
    const cleanup = vi.fn(async () => {})
    deferWatcherResourceCleanup(service, cleanup)
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    const controllerClose = vi.fn(async () => {
      await controller.promise
      await controllerRelease()
      controllerReleased.resolve()
    })
    service.setRollupWatcher({ close: controllerClose })

    const closing = service.closeAll()
    const rejected = expect(closing).rejects.toBe(failure)
    const external = externalRelease()
    const externalRejected = expect(external).rejects.toMatchObject({ errors: [failure] })
    let externalFinished = false
    void external.then(() => {
      externalFinished = true
    }, () => {
      externalFinished = true
    })
    expect(externalRelease()).toBe(external)
    controller.resolve()
    await controllerReleased.promise
    expect(cleanup).toHaveBeenCalledOnce()
    expect(externalFinished).toBe(false)
    expect(service.closeAll()).toBe(closing)
    web.reject(failure)
    await Promise.all([rejected, externalRejected])
    await expect(service.closeAll()).rejects.toBe(failure)
    await expect(externalRelease()).rejects.toMatchObject({ errors: [failure] })
    expect(controllerClose).toHaveBeenCalledOnce()
  }, 5000)

  it('preserves owner cleanup and watcher failures while awaiting every remaining resource', async () => {
    const { context, service } = createService()
    const release = retainWatcherService(service)
    const cleanupFailure = new Error('compiler close failed')
    const sidecarFailure = new Error('sidecar close failed')
    const webFailure = new Error('web close failed')
    const remaining = Promise.withResolvers<void>()
    const remainingStarted = Promise.withResolvers<void>()
    const cleanup = vi.fn(async () => {
      throw cleanupFailure
    })
    const secondCleanup = vi.fn(async () => {})
    const sidecarClose = vi.fn(async () => {
      throw sidecarFailure
    })
    const remainingClose = vi.fn(() => {
      remainingStarted.resolve()
      return remaining.promise
    })
    const webClose = vi.fn(async () => {
      throw webFailure
    })
    deferWatcherResourceCleanup(service, cleanup)
    deferWatcherResourceCleanup(service, secondCleanup)
    context.webService = { close: webClose } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({ close: () => release() })
    service.sidecarWatcherMap.set('failed', { close: sidecarClose })
    service.sidecarWatcherMap.set('remaining', { close: remainingClose })

    const closing = service.closeAll()
    const expected = {
      errors: [expect.objectContaining({ errors: [cleanupFailure] }), sidecarFailure, webFailure],
    }
    const rejected = expect(closing).rejects.toMatchObject(expected)
    let complete = false
    void Promise.resolve(closing).then(() => {
      complete = true
    }, () => {
      complete = true
    })
    await remainingStarted.promise
    expect(complete).toBe(false)
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(remainingClose).toHaveBeenCalledOnce()
    remaining.resolve()
    await rejected
    await expect(service.closeAll()).rejects.toMatchObject(expected)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(webClose).toHaveBeenCalledOnce()
  }, 5000)

  it('drains watchers added during shutdown through the same public result and retains their failure', async () => {
    const { service } = createService()
    const first = Promise.withResolvers<void>()
    const next = Promise.withResolvers<void>()
    const failure = new Error('late watcher close failed')
    const firstClose = vi.fn(() => first.promise)
    const nextClose = vi.fn(async () => {
      await next.promise
      throw failure
    })
    service.setRollupWatcher({ close: firstClose })
    const closing = service.closeAll()
    const rejected = expect(closing).rejects.toBe(failure)
    service.setRollupWatcher({ close: nextClose }, 'next')
    expect(service.closeAll()).toBe(closing)
    first.resolve()
    await first.promise
    await Promise.resolve()
    next.resolve()
    await rejected
    await expect(service.closeAll()).rejects.toBe(failure)
    expect(firstClose).toHaveBeenCalledOnce()
    expect(nextClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
  }, 5000)

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('closes a late watcher across the completion boundary after %s microtasks', async (microtasks) => {
    const { service } = createService()
    const initial = Promise.withResolvers<void>()
    const firstClose = vi.fn(() => initial.promise)
    const lateClose = vi.fn(async () => {})
    service.setRollupWatcher({ close: firstClose })
    const closing = service.closeAll()
    const late = (async () => {
      await initial.promise
      for (let index = 0; index < microtasks; index++) {
        await Promise.resolve()
      }
      service.setRollupWatcher({ close: lateClose }, 'late')
      await service.closeAll()
    })()

    initial.resolve()
    await Promise.all([closing, late])
    expect(firstClose).toHaveBeenCalledOnce()
    expect(lateClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
  }, 5000)

  it('does not inherit another project drain as permission to release resources early', async () => {
    const { service } = createService()
    const other = createService()
    const release = retainWatcherService(other.service)
    const otherWeb = Promise.withResolvers<void>()
    other.context.webService = { close: vi.fn(() => otherWeb.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    const entered = Promise.withResolvers<void>()
    const controllerClose = vi.fn(async () => {
      const releasing = release()
      entered.resolve()
      await releasing
    })
    service.setRollupWatcher({ close: controllerClose })
    let complete = false
    const closing = Promise.resolve(service.closeAll()).then(() => {
      complete = true
    })
    await entered.promise
    await Promise.resolve()
    expect(complete).toBe(false)
    otherWeb.resolve()
    await closing
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(other.context.webService.close).toHaveBeenCalledOnce()
  }, 5000)
})
