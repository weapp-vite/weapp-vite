import type { FileWatchConfig, FileWatchEngine, FileWatcher, FileWatchOptions, FileWatchTargets } from './types'
import { createFileWatcher as createProductionFileWatcher } from '../../../src/runtime/watch/fileWatcher'
import { createParcelFileWatcher } from './parcel'

export type { FileWatchChange, FileWatchConfig, FileWatchEngine, FileWatcher, FileWatchIgnore, FileWatchOptions, FileWatchReadiness, FileWatchTargets } from './types'

/** 实验调用方显式选择后端；可选配置仅复用生产侧的轮询选项解析。 */
export function createFileWatcher(
  engine: FileWatchEngine,
  targets: FileWatchTargets,
  options: FileWatchOptions,
  config: FileWatchConfig = { inlineConfig: {} },
): FileWatcher {
  if (engine !== 'chokidar' && engine !== 'parcel') {
    throw new Error(`Unknown experimental watcher engine: ${String(engine)}. Expected chokidar or parcel.`)
  }
  return engine === 'parcel'
    ? createParcelFileWatcher(config, targets, options)
    : createProductionFileWatcher(config, targets, options)
}
