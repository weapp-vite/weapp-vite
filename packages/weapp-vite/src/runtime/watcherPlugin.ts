import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { SidecarWatcher, WatcherInstance } from './watcher/types'
import { AsyncLocalStorage } from 'node:async_hooks'
import { clearWxmlDependencies } from '../wxml/processing/dependencies'
import { clearIndependentWatchFiles } from './buildPlugin/independentWatch'

export type { WatcherInstance } from './watcher/types'

export interface WatcherService {
  rollupWatcherMap: Map<string, WatcherInstance>
  sidecarWatcherMap: Map<string, SidecarWatcher>
  getRollupWatcher: (root?: string) => WatcherInstance | undefined
  setRollupWatcher: (watcher: WatcherInstance, root?: string) => void
  close: (root?: string) => void
  closeAll: () => void | Promise<void>
}

interface WatcherResourceOwner {
  count: number
  cleanup: Set<() => void | Promise<void>>
}

interface WatcherServiceDrain {
  task: Promise<void>
}

interface WatcherCloseOperation {
  service: WatcherService
  drain: WatcherServiceDrain
  active: boolean
}

const resourceOwners = new WeakMap<WatcherService, WatcherResourceOwner>()
const serviceDrains = new WeakMap<WatcherService, WatcherServiceDrain>()
const watcherCloseOperations = new AsyncLocalStorage<WatcherCloseOperation>()

async function settleControllerResources(tasks: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(tasks)
  const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (errors.length) {
    throw new AggregateError(errors, 'Development controller resource cleanup failed')
  }
}

/** 将可复用构建资源交给现有控制器释放；没有控制器时由调用方立即释放。 */
export function deferWatcherResourceCleanup(service: WatcherService | undefined, cleanup: () => void | Promise<void>): boolean {
  const owner = service && resourceOwners.get(service)
  if (!owner) {
    return false
  }
  owner.cleanup.add(cleanup)
  return true
}

/** 为长期运行的控制器保留共享资源，最后一个控制器退出时统一释放。 */
export function retainWatcherService(service: WatcherService): () => Promise<void> {
  const owner = resourceOwners.get(service) ?? { count: 0, cleanup: new Set<() => void | Promise<void>>() }
  owner.count += 1
  resourceOwners.set(service, owner)
  let resources: Promise<void> | undefined
  let releasing: Promise<void> | undefined
  let finalOwner = false
  return () => {
    if (!resources) {
      // 先发布子任务，控制器在 closeAll 内同步重入同一 release 时只等待资源本身。
      const released = Promise.withResolvers<void>()
      resources = released.promise
      owner.count -= 1
      finalOwner = owner.count === 0
      if (finalOwner) {
        resourceOwners.delete(service)
        const cleanup = [...owner.cleanup]
        owner.cleanup.clear()
        void settleControllerResources(cleanup.map(async close => await close())).then(released.resolve, released.reject)
      }
      else {
        released.resolve()
      }
    }
    const drain = serviceDrains.get(service)
    const operation = watcherCloseOperations.getStore()
    // 只有父 drain 正在等待的本服务控制器可以省去反向 join；外部调用仍等待完整关闭结果。
    if (operation?.active && operation.service === service && operation.drain === drain) {
      return resources
    }
    if (releasing) {
      return releasing
    }
    if (!finalOwner && !drain) {
      return resources
    }
    return releasing ??= settleControllerResources([
      resources,
      (async () => await service.closeAll())(),
    ])
  }
}

function createWatcherService(ctx: MutableCompilerContext): WatcherService {
  const { rollupWatcherMap, sidecarWatcherMap } = ctx.runtimeState.watcher
  let closeAllTask: Promise<void> | undefined

  const service: WatcherService = {
    rollupWatcherMap,
    sidecarWatcherMap,
    getRollupWatcher(root: string = '/') {
      return rollupWatcherMap.get(root)
    },
    setRollupWatcher(watcher: WatcherInstance, root: string = '/') {
      const oldWatcher = rollupWatcherMap.get(root)
      oldWatcher?.close()
      rollupWatcherMap.set(root, watcher)
    },
    closeAll() {
      const activeDrain = serviceDrains.get(service)
      if (activeDrain) {
        return activeDrain.task
      }
      if (closeAllTask && !rollupWatcherMap.size && !sidecarWatcherMap.size) {
        return closeAllTask
      }
      const previous = closeAllTask
      const completed = Promise.withResolvers<void>()
      const drain: WatcherServiceDrain = { task: completed.promise }
      // 必须先发布完整任务和归属，再调用可能同步释放最后 owner 的 watcher.close。
      closeAllTask = drain.task
      serviceDrains.set(service, drain)
      const closeWatchers = () => {
        const watchers = [...rollupWatcherMap.values(), ...sidecarWatcherMap.values()]
        rollupWatcherMap.clear()
        sidecarWatcherMap.clear()
        return watchers.map((watcher) => {
          const operation: WatcherCloseOperation = { service, drain, active: true }
          return watcherCloseOperations.run(operation, async () => {
            try {
              await watcher.close()
            }
            finally {
              operation.active = false
            }
          })
        })
      }
      const tasks = closeWatchers()
      if (previous) {
        tasks.unshift(previous)
      }
      if (ctx.webService) {
        tasks.push((async () => await ctx.webService!.close())())
      }
      // 一个关闭失败不能中断其余资源回收；快照退出需等全部监听器停止。
      void (async () => {
        try {
          const errors: unknown[] = []
          let pending = tasks
          do {
            const results = await Promise.allSettled(pending)
            errors.push(...results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))
            // 关闭期间接管的新 watcher 也由当前 drain 释放，公共调用共用同一完整结果。
            pending = closeWatchers()
          } while (pending.length)
          clearWxmlDependencies(ctx)
          clearIndependentWatchFiles(ctx.runtimeState.build.independent.watchFiles)
          ctx.runtimeState.build.independent.watchListeners.clear()
          if (errors.length) {
            throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Watcher service cleanup failed', { cause: errors[0] })
          }
          // 空图确认与结束归属必须在同一微任务，随后注册的 watcher 才能取得新的关闭代次。
          serviceDrains.delete(service)
          completed.resolve()
        }
        catch (error) {
          serviceDrains.delete(service)
          completed.reject(error)
        }
      })()
      return closeAllTask
    },
    close(root: string = '/') {
      const watcher = rollupWatcherMap.get(root)
      if (watcher) {
        watcher.close()
        rollupWatcherMap.delete(root)
      }
      const sidecarWatcher = sidecarWatcherMap.get(root)
      if (sidecarWatcher) {
        Promise.resolve(sidecarWatcher.close()).catch(() => {})
        sidecarWatcherMap.delete(root)
      }
      if (rollupWatcherMap.size === 0 && sidecarWatcherMap.size === 0) {
        void ctx.webService?.close().catch(() => {})
      }
    },
  }
  return service
}

export function createWatcherServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createWatcherService(ctx)
  ctx.watcherService = service
  let persistentWatch = false
  let closing: Promise<void> | undefined
  const closeSnapshotResources = () => closing ??= Promise.resolve(service.closeAll())

  return {
    name: 'weapp-runtime:watcher-service',
    configResolved(config) {
      // isDev 决定编译语义，不能让开发模式的一次性快照持有常驻 watcher。
      persistentWatch = config.command === 'serve' || Boolean(config.build.watch)
      closing = undefined
    },
    async buildEnd(error) {
      if (error && !persistentWatch && !resourceOwners.has(service)) {
        await closeSnapshotResources()
      }
    },
    async closeBundle() {
      if (!persistentWatch && !resourceOwners.has(service)) {
        await closeSnapshotResources()
      }
    },
  }
}
