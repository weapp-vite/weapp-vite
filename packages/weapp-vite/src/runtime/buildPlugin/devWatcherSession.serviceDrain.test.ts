import type { MutableCompilerContext } from '../../context'
import { expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin } from '../watcherPlugin'
import { createDevBuildWatcher } from './devBuildWatcher'
import { createDevWatcherSession } from './devWatcherSession'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return context.watcherService!
}

function generation() {
  const { watcher } = createDevBuildWatcher()
  const stopped = vi.fn(async () => {})
  watcher.on('close', stopped)
  return { watcher, stopped }
}

it.each([false, true])('joins a session restart while its generation map is empty: cleanup failure %s', async (failedCleanup) => {
  const service = createService()
  const otherService = createService()
  const owner = createDevWatcherSession(service)
  const otherOwner = createDevWatcherSession(otherService)
  const first = generation()
  const replacement = generation()
  const unrelated = generation()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const failure = new Error('session resource close failed')
  const closeResource = vi.fn(async () => {
    if (failedCleanup) {
      throw failure
    }
  })
  await owner.ownResource(closeResource)
  await owner.own(first.watcher)
  await otherOwner.own(unrelated.watcher)
  service.setRollupWatcher(first.watcher)
  otherService.setRollupWatcher(unrelated.watcher)
  const restarting = owner.restart(async () => {
    await owner.stopGeneration(first.watcher)
    service.rollupWatcherMap.delete('/')
    entered.resolve()
    await release.promise
    // 已在途的获取续体仍可登记，但关闭中的 owner 必须在返回前释放它。
    await owner.own(replacement.watcher)
  })
  let draining: Promise<void> | undefined
  try {
    await entered.promise
    expect(service.rollupWatcherMap.size).toBe(0)
    draining = Promise.resolve(service.closeAll())
    let result: PromiseSettledResult<void> | undefined
    void draining.then(
      value => result = { status: 'fulfilled', value },
      reason => result = { status: 'rejected', reason },
    )
    expect(owner.isClosing).toBe(true)
    expect(service.closeAll()).toBe(draining)
    await Promise.resolve()
    expect(result).toBeUndefined()
    expect(otherOwner.isClosing).toBe(false)
    expect(unrelated.stopped).not.toHaveBeenCalled()
    release.resolve()
    await restarting
    if (failedCleanup) {
      await expect(draining).rejects.toBe(failure)
    }
    else {
      await expect(draining).resolves.toBeUndefined()
    }
    expect(owner.isClosing).toBe(true)
    expect(first.stopped).toHaveBeenCalledOnce()
    expect(replacement.stopped).toHaveBeenCalledOnce()
    expect(closeResource).toHaveBeenCalledOnce()
    expect(service.rollupWatcherMap.size).toBe(0)
    expect(service.sidecarWatcherMap.size).toBe(0)
    expect(service.closeAll()).toBe(draining)
    expect(otherService.rollupWatcherMap.size).toBe(1)
    expect(unrelated.stopped).not.toHaveBeenCalled()
  }
  finally {
    release.resolve()
    await Promise.allSettled([restarting, draining, owner.close()])
    await otherService.closeAll()
  }
})

it('recognizes a new session after an earlier empty service drain completed', async () => {
  const service = createService()
  const previous = Promise.resolve(service.closeAll())
  await previous
  const owner = createDevWatcherSession(service)
  const current = generation()
  await owner.own(current.watcher)

  const closing = Promise.resolve(service.closeAll())

  expect(closing).not.toBe(previous)
  await closing
  expect(owner.isClosing).toBe(true)
  expect(current.stopped).toHaveBeenCalledOnce()
  expect(service.closeAll()).toBe(closing)
})

it('reports a shared resource failure once when both session and sidecar drain join its close', async () => {
  const service = createService()
  const owner = createDevWatcherSession(service)
  const failure = new Error('shared config watcher close failed')
  const closeNative = vi.fn(async () => {
    throw failure
  })
  let closing: Promise<void> | undefined
  const resource = { close: () => closing ??= closeNative() }
  await owner.ownResource(resource.close)
  service.sidecarWatcherMap.set('session-config', resource)

  const draining = Promise.resolve(service.closeAll())

  await expect(draining).rejects.toBe(failure)
  expect(closeNative).toHaveBeenCalledOnce()
  expect(service.closeAll()).toBe(draining)
  expect(service.sidecarWatcherMap.size).toBe(0)
})

it('deduplicates overlapping aggregate failures by identity while retaining independent errors with the same message', async () => {
  const service = createService()
  const owner = createDevWatcherSession(service)
  const sharedFailure = new Error('config watcher close failed')
  const independentFailure = new Error('config watcher close failed')
  const closeShared = vi.fn(async () => {
    throw sharedFailure
  })
  const closeIndependent = vi.fn(async () => {
    throw independentFailure
  })
  let closingShared: Promise<void> | undefined
  const shared = { close: () => closingShared ??= closeShared() }
  await owner.ownResource(shared.close)
  await owner.ownResource(closeIndependent)
  service.sidecarWatcherMap.set('shared-config', shared)
  const leafErrors = (error: unknown): unknown[] => error instanceof AggregateError ? error.errors.flatMap(leafErrors) : [error]

  const draining = Promise.resolve(service.closeAll())
  const failure = await draining.then(() => undefined, error => error as unknown)

  expect(leafErrors(failure)).toEqual([sharedFailure, independentFailure])
  expect(leafErrors(failure)[0]).toBe(sharedFailure)
  expect(leafErrors(failure)[1]).toBe(independentFailure)
  expect(closeShared).toHaveBeenCalledOnce()
  expect(closeIndependent).toHaveBeenCalledOnce()
  expect(service.closeAll()).toBe(draining)
  expect(service.sidecarWatcherMap.size).toBe(0)
})
