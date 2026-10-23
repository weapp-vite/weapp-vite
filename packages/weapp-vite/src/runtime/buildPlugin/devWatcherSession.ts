import type { RolldownWatcher } from 'rolldown'
import type { WatcherService } from '../watcherPlugin'
import { bindWatcherServiceController } from '../watcher/controllerClose'

interface DevWatcherGeneration {
  stop: () => Promise<void>
}

/** 将 classic 开发控制器的永久关闭与配置重启时的单代释放分开。 */
export function createDevWatcherSession(service?: WatcherService) {
  const generations = new Set<DevWatcherGeneration>()
  const watcherGenerations = new WeakMap<RolldownWatcher, DevWatcherGeneration>()
  const restarts = new Set<Promise<void>>()
  const restartFailures = new Set<unknown>()
  let closed = false
  let hasOwnership = false
  let closing: Promise<void> | undefined
  let cleanup: (() => void) | undefined

  function close() {
    closed = true
    closing ??= (async () => {
      // 重启任务拥有尚未登记的新代；它返回前必须登记并释放该代。
      const results = await Promise.allSettled([
        ...Array.from(generations, generation => generation.stop()),
        ...restarts,
      ])
      const errors = [...new Set([
        ...results.flatMap(result => result.status === 'rejected' ? [result.reason] : []),
        ...restartFailures,
      ])]
      try {
        cleanup?.()
      }
      catch (error) {
        errors.push(error)
      }
      if (errors.length) {
        throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Development watcher shutdown failed')
      }
    })()
    return closing
  }

  return {
    close,
    get isClosing() {
      return closed
    },
    get hasOwnership() {
      return hasOwnership
    },
    setCleanup(value: () => void) {
      cleanup = value
    },
    async ownResource(closeResource: () => Promise<void>) {
      let stopping: Promise<void> | undefined
      const resource: DevWatcherGeneration = {
        stop: () => stopping ??= Promise.resolve().then(closeResource).finally(() => generations.delete(resource)),
      }
      generations.add(resource)
      if (closed) {
        await resource.stop()
      }
    },
    async own(watcher: RolldownWatcher) {
      hasOwnership = true
      if (!watcherGenerations.has(watcher)) {
        const stop = watcher.close.bind(watcher)
        let stopping: Promise<void> | undefined
        const generation: DevWatcherGeneration = {
          stop: () => stopping ??= Promise.resolve().then(stop).finally(() => generations.delete(generation)),
        }
        generations.add(generation)
        watcherGenerations.set(watcher, generation)
        watcher.close = close
        if (service) {
          bindWatcherServiceController(service, watcher)
        }
      }
      if (closed) {
        await watcherGenerations.get(watcher)!.stop()
      }
    },
    async stopGeneration(watcher: RolldownWatcher) {
      await watcherGenerations.get(watcher)?.stop()
    },
    restart(run: () => Promise<void>) {
      if (closed) {
        return Promise.resolve()
      }
      // 先登记再调用，关闭时不会漏掉同步进入异步边界的重启。
      const task = Promise.resolve().then(async () => {
        if (!closed) {
          await run()
        }
      })
      restarts.add(task)
      void task.then(() => restarts.delete(task), (error) => {
        restartFailures.add(error)
        restarts.delete(task)
      })
      return task
    },
  }
}

export type DevWatcherSession = ReturnType<typeof createDevWatcherSession>
