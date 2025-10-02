import type { RolldownWatcher } from 'rolldown'
import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../context'

export interface WatcherService {
  rollupWatcherMap: Map<string, RolldownWatcher>
  getRollupWatcher: (root?: string) => RolldownWatcher | undefined
  setRollupWatcher: (watcher: RolldownWatcher, root?: string) => void
  close: (root?: string) => void
  closeAll: () => void
}

function createWatcherService(): WatcherService {
  const rollupWatcherMap = new Map<string, RolldownWatcher>()

  return {
    rollupWatcherMap,
    getRollupWatcher(root: string = '/') {
      return rollupWatcherMap.get(root)
    },
    setRollupWatcher(watcher: RolldownWatcher, root: string = '/') {
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
