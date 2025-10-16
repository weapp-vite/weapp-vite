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
  closeAll: () => void
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
    closeAll() {
      rollupWatcherMap.forEach((watcher) => {
        watcher.close()
      })
      rollupWatcherMap.clear()
      sidecarWatcherMap.forEach((watcher) => {
        Promise.resolve(watcher.close()).catch(() => {})
      })
      sidecarWatcherMap.clear()
      void ctx.webService?.close().catch(() => {})
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

  return {
    name: 'weapp-runtime:watcher-service',
    closeBundle() {
      const configService = ctx.configService
      const isWatchMode = configService?.isDev
        || Boolean(configService?.inlineConfig?.build?.watch)

      if (!isWatchMode) {
        service.closeAll()
      }
    },
  }
}
