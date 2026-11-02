import { expect, it, vi } from 'vitest'
import { deferWatcherResourceCleanup, retainWatcherService } from '../watcherPlugin'
import { CompilerSession } from './index'

function cleanupErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? (error.errors as unknown[]).flatMap(cleanupErrors) : [error]
}

it.each([false, true])('drains its own live controller before releasing shared resources: cleanup failure %s', async (failed) => {
  const session = new CompilerSession()
  const unrelated = new CompilerSession()
  session.state = 'ready'
  unrelated.state = 'ready'
  const service = session.context.watcherService
  const controllerLease = retainWatcherService(service)
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const controllerFailure = new Error('controller cleanup failed')
  const resourceFailure = new Error('shared resource cleanup failed')
  const order: string[] = []
  const resourceClose = vi.fn(async () => {
    order.push('resources')
    if (failed) {
      throw resourceFailure
    }
  })
  deferWatcherResourceCleanup(service, resourceClose)
  const controllerClose = vi.fn(async () => {
    entered.resolve()
    await release.promise
    order.push('controller')
    await controllerLease.releaseResources()
    if (failed) {
      throw controllerFailure
    }
  })
  const sidecarClose = vi.fn(async () => {
    order.push('sidecar')
  })
  const unrelatedClose = vi.fn(async () => {})
  service.setRollupWatcher({ close: controllerClose })
  service.sidecarWatcherMap.set('owned-sidecar', { close: sidecarClose })
  unrelated.context.watcherService.setRollupWatcher({ close: unrelatedClose })
  if (failed) {
    // 早先的用户清理失败仍须让控制器和共享资源各自完成终结。
    session.onClose(() => {
      throw controllerFailure
    })
  }
  const closing = session.close()
  const result = closing.then(
    () => ({ status: 'fulfilled' as const }),
    reason => ({ status: 'rejected' as const, reason: reason as unknown }),
  )
  try {
    // 旧实现会先完成 close，却从未通知仍持有第二份引用的控制器。
    await Promise.race([entered.promise, result])
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(session.close()).toBe(closing)
    expect(session.state).toBe('closing')
    expect(resourceClose).not.toHaveBeenCalled()
    expect(unrelatedClose).not.toHaveBeenCalled()
    release.resolve()
    const outcome = await result
    if (failed) {
      expect(outcome.status).toBe('rejected')
      if (outcome.status === 'rejected') {
        expect(cleanupErrors(outcome.reason)).toEqual([controllerFailure, resourceFailure])
      }
    }
    else {
      expect(outcome).toEqual({ status: 'fulfilled' })
    }
    expect(order).toEqual(['controller', 'sidecar', 'resources'])
    expect(controllerClose).toHaveBeenCalledOnce()
    expect(sidecarClose).toHaveBeenCalledOnce()
    expect(resourceClose).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
    expect(session.state).toBe('closed')
    expect(session.close()).toBe(closing)
    expect(unrelated.context.watcherService.rollupWatcherMap.size).toBe(1)
    expect(unrelatedClose).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
    await Promise.allSettled([closing, service.closeAll()])
    await Promise.allSettled([controllerLease.releaseResources(), unrelated.close()])
  }
})
