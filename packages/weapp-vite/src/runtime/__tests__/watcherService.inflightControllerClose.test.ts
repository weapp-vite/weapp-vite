import type { MutableCompilerContext } from '../../context'
import { expect, it, vi } from 'vitest'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createDevWatcherSession } from '../buildPlugin/devWatcherSession'
import { createRuntimeState } from '../runtimeState'
import { bindWatcherServiceController } from '../watcher/controllerClose'
import { createWatcherServicePlugin, deferWatcherResourceCleanup, retainWatcherService } from '../watcherPlugin'

function createService() {
  const context = { runtimeState: createRuntimeState() } as MutableCompilerContext
  createWatcherServicePlugin(context)
  return context.watcherService!
}

function observe(task: Promise<void>) {
  let result: PromiseSettledResult<void> | undefined
  void task.then(
    value => result = { status: 'fulfilled', value },
    reason => result = { status: 'rejected', reason },
  )
  return () => result
}

function containsFailure(error: unknown, failure: Error): boolean {
  return error === failure || (error instanceof AggregateError && error.errors.some(nested => containsFailure(nested, failure)))
}

it('retains each classic session independently when no generation is in its service map', async () => {
  const first = createService()
  const second = createService()
  await first.closeAll()
  const firstOwner = createDevWatcherSession(first)
  const secondOwner = createDevWatcherSession(second)
  const firstController = createDevBuildWatcher()
  const secondController = createDevBuildWatcher()
  const stopping = Promise.withResolvers<void>()
  const firstStopped = vi.fn(() => stopping.promise)
  const secondStopped = vi.fn(async () => {})
  const sidecarClosed = vi.fn(async () => {})
  firstController.watcher.on('close', firstStopped)
  secondController.watcher.on('close', secondStopped)
  await firstOwner.own(firstController.watcher)
  await firstOwner.own(firstController.watcher)
  await secondOwner.own(secondController.watcher)
  first.sidecarWatcherMap.set('shared', { close: sidecarClosed })

  const closing = first.closeAll()
  try {
    await vi.waitFor(() => expect(firstStopped).toHaveBeenCalledOnce())
    expect(sidecarClosed).not.toHaveBeenCalled()
  }
  finally {
    stopping.resolve()
  }
  await closing
  await first.closeAll()
  expect(firstStopped).toHaveBeenCalledOnce()
  expect(sidecarClosed).toHaveBeenCalledOnce()
  expect(secondStopped).not.toHaveBeenCalled()
  expect(firstOwner.isClosing).toBe(true)
  expect(secondOwner.isClosing).toBe(false)
  await second.closeAll()
  await second.closeAll()
  expect(secondStopped).toHaveBeenCalledOnce()
})

it('waits for an owner-only restart and its late generation before closing shared sidecars', async () => {
  const service = createService()
  const owner = createDevWatcherSession(service)
  const first = createDevBuildWatcher()
  const replacement = createDevBuildWatcher()
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  const trace: string[] = []
  const replacementStopped = vi.fn(async () => {
    trace.push('replacement-stopped')
  })
  const sidecarStopped = vi.fn(async () => {
    trace.push('sidecar-stopped')
  })
  replacement.watcher.on('close', replacementStopped)
  await owner.own(first.watcher)
  const restarting = owner.restart(async () => {
    await owner.stopGeneration(first.watcher)
    entered.resolve()
    await resume.promise
    await owner.own(replacement.watcher)
  })
  await entered.promise
  service.sidecarWatcherMap.set('shared', { close: sidecarStopped })
  const closing = service.closeAll()
  try {
    await Promise.resolve()
    expect(sidecarStopped).not.toHaveBeenCalled()
  }
  finally {
    resume.resolve()
  }
  await Promise.all([closing, restarting])
  expect(replacementStopped).toHaveBeenCalledOnce()
  expect(sidecarStopped).toHaveBeenCalledOnce()
  expect(trace).toEqual(['replacement-stopped', 'sidecar-stopped'])
})

it.each([false, true])('joins a controller close started before the service drain without waiting on itself: cleanup failure %s', async (failedCleanup) => {
  const service = createService()
  const other = createService()
  const otherClose = vi.fn(async () => {})
  other.setRollupWatcher({ close: otherClose })

  const releaseResources = retainWatcherService(service)
  const failure = new Error('controller resource close failed')
  const resourceClose = vi.fn(async () => {
    if (failedCleanup) {
      throw failure
    }
  })
  deferWatcherResourceCleanup(service, resourceClose)
  const sidecarClose = vi.fn(async () => {})
  service.sidecarWatcherMap.set('sidecar', { close: sidecarClose })

  const entered = Promise.withResolvers<void>()
  const continueClose = Promise.withResolvers<void>()
  const controller = createDevWatcherSession()
  const { watcher } = createDevBuildWatcher()
  const nativeClose = watcher.close.bind(watcher)
  const generationClose = vi.fn(async () => {
    entered.resolve()
    await continueClose.promise
    await nativeClose()
    await releaseResources.releaseResources()
  })
  watcher.close = generationClose
  await controller.own(watcher)
  service.setRollupWatcher(watcher)
  bindWatcherServiceController(service, watcher)

  // 配置重启先关闭本代，之后整体退出才加入同一控制器；原关闭续体不会继承后来的 drain 上下文。
  const generationStopping = controller.stopGeneration(watcher)
  const stopped = observe(generationStopping)
  await entered.promise
  const draining = service.closeAll() as Promise<void>
  const drained = observe(draining)
  const publicClosing = watcher.close()
  const publicClosed = observe(publicClosing)
  expect(service.closeAll()).toBe(draining)
  expect(watcher.close()).toBe(publicClosing)
  expect(resourceClose).not.toHaveBeenCalled()
  expect(otherClose).not.toHaveBeenCalled()

  continueClose.resolve()
  await vi.waitFor(() => {
    expect(stopped()).toBeDefined()
    expect(drained()).toBeDefined()
    expect(publicClosed()).toBeDefined()
  }, { timeout: 500, interval: 10 })

  for (const result of [stopped(), drained(), publicClosed()]) {
    if (failedCleanup) {
      expect(result?.status).toBe('rejected')
      expect(result?.status === 'rejected' && containsFailure(result.reason, failure)).toBe(true)
    }
    else {
      expect(result).toEqual({ status: 'fulfilled', value: undefined })
    }
  }
  expect(service.closeAll()).toBe(draining)
  expect(watcher.close()).toBe(publicClosing)
  expect(generationClose).toHaveBeenCalledOnce()
  expect(resourceClose).toHaveBeenCalledOnce()
  expect(sidecarClose).toHaveBeenCalledOnce()
  expect(service.rollupWatcherMap.size).toBe(0)
  expect(service.sidecarWatcherMap.size).toBe(0)
  expect(otherClose).not.toHaveBeenCalled()
  expect(other.rollupWatcherMap.size).toBe(1)
  await other.closeAll()
  await other.closeAll()
  expect(otherClose).toHaveBeenCalledOnce()
})

it.each([false, true])('drains a classic generation registered by an independent restart after façade shutdown starts: cleanup failure %s', async (failedCleanup) => {
  const service = createService()
  const restartEntered = Promise.withResolvers<void>()
  const continueRestart = Promise.withResolvers<void>()
  const stoppingEntered = Promise.withResolvers<void>()
  const continueStopping = Promise.withResolvers<void>()
  const failure = new Error('late classic cleanup failed')
  const resourceClose = vi.fn(async () => {
    if (failedCleanup) {
      throw failure
    }
  })
  const sidecarClose = vi.fn(async () => {})
  const releaseSession = vi.fn()
  const owner = createDevWatcherSession(service)
  const { watcher: facade } = createDevBuildWatcher()
  let closed = false
  let generationClose: ReturnType<typeof vi.fn> | undefined
  let closeFacade: Promise<void> | undefined

  // R 在 D 之前建立，代次释放续体不会继承整体 drain 的 AsyncLocalStorage。
  const restarting = Promise.resolve().then(async () => {
    restartEntered.resolve()
    await continueRestart.promise
    const lease = retainWatcherService(service)
    deferWatcherResourceCleanup(service, resourceClose)
    service.sidecarWatcherMap.set('late-sidecar', { close: sidecarClose })
    const { watcher } = createDevBuildWatcher()
    const nativeClose = watcher.close.bind(watcher)
    generationClose = vi.fn(async () => {
      stoppingEntered.resolve()
      await continueStopping.promise
      await nativeClose()
      await lease.releaseResources()
    })
    watcher.close = generationClose
    // stateful → classic 沿用已关闭的 public façade，不能再次捕获其完整关闭包装器。
    // 与 runDev 一样先登记会话清理；closing owner 的迟到获取可能在释放时直接抛错。
    bindWatcherServiceController(service, facade, releaseSession)
    await owner.own(watcher)
    service.setRollupWatcher(facade)
    if (closed) {
      await owner.stopGeneration(watcher)
    }
  })
  const restarted = observe(restarting)
  facade.close = () => {
    closed = true
    return closeFacade ??= restarting
  }
  bindWatcherServiceController(service, facade)
  service.setRollupWatcher(facade)
  await restartEntered.promise

  const draining = service.closeAll() as Promise<void>
  const drained = observe(draining)
  const publicClosing = facade.close()
  const publicClosed = observe(publicClosing)
  expect(closed).toBe(true)
  expect(service.closeAll()).toBe(draining)
  expect(facade.close()).toBe(publicClosing)
  continueRestart.resolve()
  await stoppingEntered.promise
  expect(drained()).toBeUndefined()
  expect(resourceClose).not.toHaveBeenCalled()
  expect(releaseSession).not.toHaveBeenCalled()
  continueStopping.resolve()

  await vi.waitFor(() => {
    expect(restarted()).toBeDefined()
    expect(drained()).toBeDefined()
    expect(publicClosed()).toBeDefined()
  }, { timeout: 500, interval: 10 })
  for (const result of [restarted(), drained(), publicClosed()]) {
    if (failedCleanup) {
      expect(result?.status).toBe('rejected')
      expect(result?.status === 'rejected' && containsFailure(result.reason, failure)).toBe(true)
    }
    else {
      expect(result).toEqual({ status: 'fulfilled', value: undefined })
    }
  }
  expect(generationClose).toHaveBeenCalledOnce()
  expect(resourceClose).toHaveBeenCalledOnce()
  expect(sidecarClose).toHaveBeenCalledOnce()
  expect(releaseSession).toHaveBeenCalledOnce()
  expect(facade.close()).toBe(publicClosing)
  expect(service.closeAll()).toBe(draining)
  expect(service.rollupWatcherMap.size).toBe(0)
  expect(service.sidecarWatcherMap.size).toBe(0)
})
