import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'

export interface WatcherInstance {
  close: () => void | Promise<void>
}

export interface WatcherService {
  rollupWatcherMap: Map<string, WatcherInstance>
  getRollupWatcher: (root?: string) => WatcherInstance | undefined
  setRollupWatcher: (watcher: WatcherInstance, root?: string) => void
  close: (root?: string) => void
  closeAll: () => void
}

function createWatcherService(): WatcherService {
  const rollupWatcherMap = new Map<string, WatcherInstance>()

  return {
    rollupWatcherMap,
    getRollupWatcher(root: string = '/') {
      return rollupWatcherMap.get(root)
    },
    setRollupWatcher(watcher: WatcherInstance, root: string = '/') {
      const oldWatcher = rollupWatcherMap.get(root)
      oldWatcher?.close()
      rollupWatcherMap.set(root, watcher)
    },
    closeAll() {
      rollupWatcherMap.forEach((watcher) => {
        watcher.close()
      })
      rollupWatcherMap.clear()
    },
    close(root: string = '/') {
      const watcher = rollupWatcherMap.get(root)
      if (watcher) {
        watcher.close()
        rollupWatcherMap.delete(root)
      }
    },
  }
}

export function createWatcherServicePlugin(ctx: MutableCompilerContext): Plugin {
  const service = createWatcherService()
  ctx.watcherService = service

  return {
    name: 'weapp-runtime:watcher-service',
    closeBundle() {
      service.closeAll()
    },
  }
}
