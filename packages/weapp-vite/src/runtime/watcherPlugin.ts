import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'
import type { SidecarWatcher, WatcherInstance } from './watcher/types'

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

const resourceOwners = new WeakMap<WatcherService, WatcherResourceOwner>()

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
  let releasing: Promise<void> | undefined
  return () => releasing ??= (async () => {
    owner.count -= 1
    if (owner.count > 0) {
      return
    }
    resourceOwners.delete(service)
    const cleanup = [...owner.cleanup]
    owner.cleanup.clear()
    const results = await Promise.allSettled([
      ...cleanup.map(async close => await close()),
      (async () => await service.closeAll())(),
    ])
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (errors.length) {
      throw new AggregateError(errors, 'Development controller resource cleanup failed')
    }
  })()
}

function createWatcherService(ctx: MutableCompilerContext): WatcherService {
  const { rollupWatcherMap, sidecarWatcherMap } = ctx.runtimeState.watcher

  return {
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
    async closeAll() {
      const watchers = [...rollupWatcherMap.values(), ...sidecarWatcherMap.values()]
      rollupWatcherMap.clear()
      sidecarWatcherMap.clear()
      const tasks = watchers.map(async watcher => await watcher.close())
      if (ctx.webService) {
        tasks.push((async () => await ctx.webService!.close())())
      }
      // 一个关闭失败不能中断其余资源回收；快照退出需等全部监听器停止。
      await Promise.allSettled(tasks)
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
