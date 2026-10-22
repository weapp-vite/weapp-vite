import type { MutableCompilerContext } from '../../context'
import { describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { captureWatcherCloseOperation, createWatcherControllerClose, createWatcherServicePlugin, retainWatcherService } from '../watcherPlugin'

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
    const close = createWatcherControllerClose(service, closeLocal)
    service.setRollupWatcher({ close })
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
    const close = createWatcherControllerClose(service, () => local.promise)
    service.setRollupWatcher({ close })
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
    let runClose!: ReturnType<typeof captureWatcherCloseOperation>
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({
      close: async () => {
        runClose = captureWatcherCloseOperation(service)
        await generation.promise
      },
    })
    const closing = service.closeAll()
    // 新代在先前创建的异步链中收尾，必须显式使用父关闭交接的归属。
    await runClose(release)
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
    let previousClose!: ReturnType<typeof captureWatcherCloseOperation>
    service.setRollupWatcher({ close: async () => {
      previousClose = captureWatcherCloseOperation(service)
    } })
    await service.closeAll()
    const release = retainWatcherService(service)
    const web = Promise.withResolvers<void>()
    context.webService = { close: vi.fn(() => web.promise) } as unknown as NonNullable<MutableCompilerContext['webService']>
    service.setRollupWatcher({ close: async () => {
      await release()
    } })
    const closing = service.closeAll()
    let staleFinished = false
    const stale = previousClose(release).then(() => {
      staleFinished = true
    })
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
    let wrongServiceClose!: ReturnType<typeof captureWatcherCloseOperation>
    first.service.setRollupWatcher({
      close: async () => {
        wrongServiceClose = captureWatcherCloseOperation(second.service)
      },
    })
    const firstClosing = first.service.closeAll()
    let finished = false
    const secondClosing = wrongServiceClose(release).then(() => {
      finished = true
    })
    await firstClosing
    expect(finished).toBe(false)
    web.resolve()
    await secondClosing
    expect(finished).toBe(true)
  })
})
