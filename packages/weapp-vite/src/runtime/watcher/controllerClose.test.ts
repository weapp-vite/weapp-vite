import type { MutableCompilerContext } from '../../context'
import type { WatcherInstance } from './types'
import { describe, expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createDevWatcherSession } from '../buildPlugin/devWatcherSession'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin, retainWatcherService } from '../watcherPlugin'
import { bindWatcherServiceController, closeWatcherControllerResources } from './controllerClose'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return { context, service: context.watcherService! }
}

function startClose(watcher: WatcherInstance): Promise<void> {
  const closing = watcher.close()
  expect(closing).toBeInstanceOf(Promise)
  return closing as Promise<void>
}

function leafErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]
}

describe('development watcher controller close', () => {
  it.each(['public', 'service'] as const)('publishes the full drain before a controller releases its lease through the %s entry', async (entry) => {
    const { context, service } = createService()
    const lease = retainWatcherService(service)
    const resourcesReleased = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const resourceClose = vi.fn(async () => {
      await lease()
      resourcesReleased.resolve()
    })
    const watcher: WatcherInstance = { close: resourceClose }
    bindWatcherServiceController(service, watcher)
    service.setRollupWatcher(watcher)
    context.webService = { close: () => web.promise } as unknown as NonNullable<MutableCompilerContext['webService']>

    const closing = entry === 'public' ? startClose(watcher) : Promise.resolve(service.closeAll())
    const publicClosing = startClose(watcher)
    let finished = false
    const completed = Promise.all([closing, publicClosing]).then(() => {
      finished = true
    })
    try {
      await resourcesReleased.promise
      expect(finished).toBe(false)
      expect(resourceClose).toHaveBeenCalledOnce()
      expect(watcher.close()).toBe(publicClosing)
    }
    finally {
      web.resolve()
    }
    await completed
    expect(finished).toBe(true)
  })

  it('keeps direct public close pending until controller, sidecar and web resources finish', async () => {
    const { context, service } = createService()
    const resources = Promise.withResolvers<void>()
    const sidecar = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const webEntered = Promise.withResolvers<void>()
    const resourceClose = vi.fn(() => resources.promise)
    const sidecarClose = vi.fn(() => sidecar.promise)
    const webClose = vi.fn(() => {
      webEntered.resolve()
      return web.promise
    })
    const cleanup = vi.fn()
    const watcher: WatcherInstance = { close: resourceClose }
    context.webService = { close: webClose } as unknown as NonNullable<MutableCompilerContext['webService']>
    bindWatcherServiceController(service, watcher, cleanup)
    service.setRollupWatcher(watcher)
    service.sidecarWatcherMap.set('sidecar', { close: sidecarClose })

    const closing = startClose(watcher)
    let finished = false
    void closing.then(() => {
      finished = true
    }, () => {
      finished = true
    })
    expect(watcher.close()).toBe(closing)
    await webEntered.promise
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(webClose).toHaveBeenCalledOnce()
    expect(finished).toBe(false)

    resources.resolve()
    await closeWatcherControllerResources(service, watcher)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(finished).toBe(false)
    sidecar.resolve()
    await sidecar.promise
    expect(finished).toBe(false)
    web.resolve()
    await closing
    expect(finished).toBe(true)
    expect(watcher.close()).toBe(closing)
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
  })

  it('starts the complete drain after a synchronous resource failure and preserves every cleanup failure', async () => {
    const { context, service } = createService()
    const resourceFailure = new Error('controller close failed')
    const cleanupFailure = new Error('controller cleanup failed')
    const sidecarFailure = new Error('sidecar close failed')
    const webFailure = new Error('web close failed')
    const sidecarEntered = Promise.withResolvers<void>()
    const finishSidecar = Promise.withResolvers<void>()
    const resourceClose = vi.fn(() => {
      throw resourceFailure
    })
    const failedCleanup = vi.fn(() => {
      throw cleanupFailure
    })
    const remainingCleanup = vi.fn()
    const sidecarClose = vi.fn(async () => {
      sidecarEntered.resolve()
      await finishSidecar.promise
      throw sidecarFailure
    })
    const webClose = vi.fn(async () => {
      throw webFailure
    })
    const watcher: WatcherInstance = { close: resourceClose }
    context.webService = { close: webClose } as unknown as NonNullable<MutableCompilerContext['webService']>
    bindWatcherServiceController(service, watcher, failedCleanup)
    bindWatcherServiceController(service, watcher, remainingCleanup)
    service.setRollupWatcher(watcher)
    service.sidecarWatcherMap.set('sidecar', { close: sidecarClose })

    const closing = startClose(watcher)
    const failure = closing.catch(error => error as unknown)
    let finished = false
    void failure.then(() => {
      finished = true
    })
    await sidecarEntered.promise
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(failedCleanup).toHaveBeenCalledOnce()
    expect(remainingCleanup).toHaveBeenCalledOnce()
    expect(webClose).toHaveBeenCalledOnce()
    expect(finished).toBe(false)
    expect(watcher.close()).toBe(closing)

    finishSidecar.resolve()
    const error = await failure
    expect(error).toBeInstanceOf(AggregateError)
    expect(new Set(leafErrors(error))).toEqual(new Set([resourceFailure, cleanupFailure, sidecarFailure, webFailure]))
    expect(watcher.close()).toBe(closing)
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
  })

  it('retains the original error when the controller and service observe the same failure', async () => {
    const { service } = createService()
    const failure = new Error('shared controller failure')
    const resourceClose = vi.fn(() => {
      throw failure
    })
    const watcher: WatcherInstance = { close: resourceClose }
    bindWatcherServiceController(service, watcher)
    service.setRollupWatcher(watcher)

    const closing = startClose(watcher)
    await expect(closing).rejects.toBe(failure)
    await expect(watcher.close()).rejects.toBe(failure)
    expect(watcher.close()).toBe(closing)
    expect(resourceClose).toHaveBeenCalledOnce()
  })

  it('keeps generation resource close separate from public shutdown of the remaining service', async () => {
    const { service } = createService()
    const resourceClose = vi.fn(async () => {})
    const sidecarClose = vi.fn(async () => {})
    const watcher: WatcherInstance = { close: resourceClose }
    bindWatcherServiceController(service, watcher)
    service.setRollupWatcher(watcher)
    service.sidecarWatcherMap.set('sidecar', { close: sidecarClose })

    const resourceClosing = closeWatcherControllerResources(service, watcher)
    expect(closeWatcherControllerResources(service, watcher)).toBe(resourceClosing)
    await resourceClosing
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(sidecarClose).not.toHaveBeenCalled()
    expect(service.getRollupWatcher()).toBe(watcher)

    await startClose(watcher)
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
  })

  it.each(['public', 'service'] as const)('closes an active classic controller behind a façade without reverse joining its %s drain', async (entry) => {
    const { context, service } = createService()
    const lease = retainWatcherService(service)
    const stopping = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const webEntered = Promise.withResolvers<void>()
    const classic = createDevBuildWatcher().watcher
    const nativeClose = classic.close.bind(classic)
    const generationClose = vi.fn(async () => {
      stopping.resolve()
      await resume.promise
      await nativeClose()
      await lease.releaseResources()
    })
    classic.close = generationClose
    await createDevWatcherSession(service).own(classic)
    const facade = createDevBuildWatcher().watcher
    const closeFacade = facade.close.bind(facade)
    const cleanup = vi.fn()
    facade.close = async () => {
      await closeWatcherControllerResources(service, classic)
      await closeFacade()
    }
    context.webService = {
      close() {
        webEntered.resolve()
        return web.promise
      },
    } as unknown as NonNullable<MutableCompilerContext['webService']>
    bindWatcherServiceController(service, facade, cleanup)
    service.setRollupWatcher(facade)

    const closing = entry === 'public' ? startClose(facade) : Promise.resolve(service.closeAll())
    await stopping.promise
    const publicClosing = startClose(facade)
    const classicClosing = startClose(classic)
    expect(facade.close()).toBe(publicClosing)
    expect(classic.close()).toBe(classicClosing)
    let finished = false
    const completed = Promise.all([closing, publicClosing, classicClosing]).then(() => {
      finished = true
    })
    resume.resolve()
    await webEntered.promise
    expect(finished).toBe(false)
    web.resolve()
    await completed
    expect(generationClose).toHaveBeenCalledOnce()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
    expect(facade.close()).toBe(publicClosing)
    expect(classic.close()).toBe(classicClosing)
  })

  it('preserves the native receiver and only drains the service that owns the controller', async () => {
    const first = createService()
    const second = createService()
    const receivers: WatcherInstance[] = []
    const firstClose = vi.fn(function (this: WatcherInstance) {
      receivers.push(this)
    })
    const secondClose = vi.fn(function (this: WatcherInstance) {
      receivers.push(this)
    })
    const otherSidecarClose = vi.fn(async () => {})
    const firstWatcher: WatcherInstance = { close: firstClose }
    const secondWatcher: WatcherInstance = { close: secondClose }
    bindWatcherServiceController(first.service, firstWatcher)
    bindWatcherServiceController(second.service, secondWatcher)
    first.service.setRollupWatcher(firstWatcher)
    second.service.setRollupWatcher(secondWatcher)
    second.service.sidecarWatcherMap.set('sidecar', { close: otherSidecarClose })

    await startClose(firstWatcher)
    expect(receivers).toEqual([firstWatcher])
    expect(firstClose).toHaveBeenCalledOnce()
    expect(secondClose).not.toHaveBeenCalled()
    expect(otherSidecarClose).not.toHaveBeenCalled()
    expect(second.service.getRollupWatcher()).toBe(secondWatcher)
    await startClose(secondWatcher)
    expect(receivers).toEqual([firstWatcher, secondWatcher])
    expect(secondClose).toHaveBeenCalledOnce()
    expect(otherSidecarClose).toHaveBeenCalledOnce()
  })

  it('reuses the first public close and resource owner while accepting cleanup across later generations', async () => {
    const { service } = createService()
    const resources = Promise.withResolvers<void>()
    const resourceClose = vi.fn(() => resources.promise)
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const pendingCleanup = vi.fn()
    const finishedCleanup = vi.fn()
    const watcher: WatcherInstance = { close: resourceClose }
    expect(bindWatcherServiceController(service, watcher, firstCleanup)).toBe(false)
    const publicClose = watcher.close
    expect(bindWatcherServiceController(service, watcher, secondCleanup)).toBe(false)
    expect(watcher.close).toBe(publicClose)
    service.setRollupWatcher(watcher)

    const closing = startClose(watcher)
    await Promise.resolve()
    expect(bindWatcherServiceController(service, watcher, pendingCleanup)).toBe(true)
    expect(watcher.close).toBe(publicClose)
    expect(publicClose()).toBe(closing)
    resources.resolve()
    await closing
    expect(firstCleanup).toHaveBeenCalledOnce()
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(pendingCleanup).toHaveBeenCalledOnce()
    expect(resourceClose).toHaveBeenCalledOnce()

    expect(bindWatcherServiceController(service, watcher, finishedCleanup)).toBe(true)
    expect(finishedCleanup).toHaveBeenCalledOnce()
    expect(watcher.close).toBe(publicClose)
    expect(publicClose()).toBe(closing)
    expect(resourceClose).toHaveBeenCalledOnce()
  })
})
