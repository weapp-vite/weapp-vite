import type { FileWatchConfig, FileWatchEngine, FileWatcher, FileWatchOptions, FileWatchTargets } from './types'
import process from 'node:process'
import { createChokidarFileWatcher } from './chokidar'
import { createParcelFileWatcher } from './parcel'

export type { FileWatchChange, FileWatchConfig, FileWatchEngine, FileWatcher, FileWatchIgnore, FileWatchOptions, FileWatchReadiness, FileWatchTargets } from './types'

export function resolveFileWatchEngine(config: FileWatchConfig): FileWatchEngine {
  const engine = config.inlineConfig?.weapp?.watch?.engine ?? process.env.WEAPP_VITE_WATCH_ENGINE ?? 'chokidar'
  if (engine !== 'chokidar' && engine !== 'parcel') {
    throw new Error(`Unknown weapp.watch.engine: ${String(engine)}. Expected chokidar or parcel.`)
  }
  return engine
}

/** 自有文件观察统一选择后端；构建器的依赖观察仍由其原生生命周期管理。 */
export function createFileWatcher(config: FileWatchConfig, targets: FileWatchTargets, options: FileWatchOptions): FileWatcher {
  return resolveFileWatchEngine(config) === 'parcel'
    ? createParcelFileWatcher(config, targets, options)
    : createChokidarFileWatcher(config, targets, options)
}
