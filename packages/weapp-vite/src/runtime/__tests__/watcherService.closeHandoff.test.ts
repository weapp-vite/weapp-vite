import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { bindWatcherServiceController } from '../watcher/controllerClose'
import { createWatcherServicePlugin, retainWatcherService } from '../watcherPlugin'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return { context, service: context.watcherService! }
}

describe('watcher service close operation handoff', () => {
  it.each(['controller', 'service'])('publishes one close before synchronous reentry with %s closing first', async (first) => {
    const { context, service } = createService()
    const local = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    const closeLocal = vi.fn(async () => {
      started.resolve()
      await local.promise
    })
    const watcher = { close: closeLocal }
    bindWatcherServiceController(service, watcher)
    const close = watcher.close
    service.setRollupWatcher(watcher)
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    const initial = first === 'controller' ? close() : service.closeAll()
    const publicClose = close()
    expect(close()).toBe(publicClose)
    const drained = service.closeAll()
    await started.promise
    expect(closeLocal).toHaveBeenCalledOnce()
    let completed = false
    const closing = Promise.all([initial, publicClose, drained]).then(() => {
      completed = true
    })
    local.resolve()
    await local.promise
    expect(completed).toBe(false)
    web.resolve()
    await closing
    expect(completed).toBe(true)
    expect(closeLocal).toHaveBeenCalledOnce()
    expect(context.webService.close).toHaveBeenCalledOnce()
  })

  it.each(['controller', 'service'])('retains one local failure and waits for independent resources with %s closing first', async (first) => {
    const { context, service } = createService()
    const failure = new Error('generation failed to close')
    const local = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    const watcher = { close: () => local.promise }
    bindWatcherServiceController(service, watcher)
    const close = watcher.close
    service.setRollupWatcher(watcher)
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    const initial = first === 'controller' ? close() : service.closeAll()
    const publicClose = close()
    const settled = Promise.allSettled([initial, publicClose])
    let completed = false
    void settled.then(() => {
      completed = true
    })
    local.reject(failure)
    await Promise.resolve()
    expect(completed).toBe(false)
    web.resolve()
    expect(await settled).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ])
    expect(close()).toBe(publicClose)
  })

  it('allows a pending generation to release locally while external callers still join its parent drain', async () => {
    const { context, service } = createService()
    const release = retainWatcherService(service)
    const generation = Promise.withResolvers<void>()
    const web = Promise.withResolvers<void>()
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({
      close: async () => {
        await generation.promise
      },
    })
    const closing = service.closeAll()
    // 新代在先前创建的异步链中收尾，只释放其持有的资源；外部调用仍等待完整 drain。
    await release.releaseResources()
    let externalFinished = false
    const external = release().then(() => {
      externalFinished = true
    })
    generation.resolve()
    await generation.promise
    expect(externalFinished).toBe(false)
    web.resolve()
    await Promise.all([closing, external])
    expect(externalFinished).toBe(true)
  })

  it('does not reuse a finished operation to bypass a later drain', async () => {
    const { context, service } = createService()
    const resumePrevious = Promise.withResolvers<void>()
    let release!: ReturnType<typeof retainWatcherService>
    let stale!: Promise<void>
    let staleFinished = false
    service.setRollupWatcher({ close: async () => {
      // 保留真实的旧异步上下文；旧操作结束后不能把它当作新 drain 的内部权限。
      stale = resumePrevious.promise.then(async () => {
        await release()
        staleFinished = true
      })
    } })
    await service.closeAll()
    release = retainWatcherService(service)
    const web = Promise.withResolvers<void>()
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({ close: async () => {
      await release()
    } })
    const closing = service.closeAll()
    resumePrevious.resolve()
    await Promise.resolve()
    expect(staleFinished).toBe(false)
    web.resolve()
    await Promise.all([closing, stale])
    expect(staleFinished).toBe(true)
  })

  it('does not hand another service the active drain ownership', async () => {
    const first = createService()
    const second = createService()
    const release = retainWatcherService(second.service)
    const web = Promise.withResolvers<void>()
    second.context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    let secondClosing!: Promise<void>
    let finished = false
    first.service.setRollupWatcher({
      close: async () => {
        secondClosing = release().then(() => {
          finished = true
        })
      },
    })
    const firstClosing = first.service.closeAll()
    await firstClosing
    expect(finished).toBe(false)
    web.resolve()
    await secondClosing
    expect(finished).toBe(true)
  })
})
