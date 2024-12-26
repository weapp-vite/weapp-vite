import type { RollupWatcher } from 'rollup'
import { injectable } from 'inversify'

@injectable()
export class WatcherService {
  rollupWatcherMap: Map<string, RollupWatcher>

  constructor() {
    this.rollupWatcherMap = new Map() // 初始化rollup监视器映射
  }

  setRollupWatcher(watcher: RollupWatcher, root: string = '/') {
    const oldWatcher = this.rollupWatcherMap.get(root)
    oldWatcher?.close()
    this.rollupWatcherMap.set(root, watcher)
  }
}
