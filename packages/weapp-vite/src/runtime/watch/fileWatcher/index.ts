import type { FileWatchConfig, FileWatcher, FileWatchOptions, FileWatchTargets } from './types'
import { createChokidarFileWatcher } from './chokidar'

export type { FileWatchChange, FileWatchConfig, FileWatcher, FileWatchIgnore, FileWatchOptions, FileWatchReadiness, FileWatchTargets } from './types'

/** 生产文件观察统一依赖共享契约，当前由 Chokidar 适配器提供实现。 */
export function createFileWatcher(config: FileWatchConfig, targets: FileWatchTargets, options: FileWatchOptions): FileWatcher {
  return createChokidarFileWatcher(config, targets, options)
}
