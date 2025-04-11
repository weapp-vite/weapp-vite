import type { RollupWatcher } from 'rollup'
import { injectable } from 'inversify'

@injectable()
export class WatcherService {
  rollupWatcherMap: Map<string, RollupWatcher>

  constructor() {
    this.rollupWatcherMap = new Map() // 初始化rollup监视器映射
  }

  getRollupWatcher(root: string = '/') {
    return this.rollupWatcherMap.get(root)
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.getRollupWatcher(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }

  closeAll() {
    this.rollupWatcherMap.forEach((watcher) => {
      watcher.close()
    })
    this.rollupWatcherMap.clear()
  }

  close(root: string = '/') {
    const watcher = this.getRollupWatcher(root)
    if (watcher) {
      watcher.close()
      this.rollupWatcherMap.delete(root)
    }
  }
}
