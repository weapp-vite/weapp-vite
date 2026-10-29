import type { Stats } from 'node:fs'
import type { ConfigService } from '../../config/types'

export type FileWatchReadiness = 'ready' | 'closed'
export type FileWatchEngine = 'chokidar' | 'parcel'
export type FileWatchTargets = string | string[]
export type FileWatchConfig = Pick<ConfigService, 'inlineConfig'>
export type FileWatchIgnore = string | RegExp | ((file: string, stats?: Stats) => boolean)

export interface FileWatchOptions {
  persistent?: boolean
  ignoreInitial?: boolean
  depth?: number
  ignored?: FileWatchIgnore | FileWatchIgnore[]
  stability?: { threshold: number, interval: number }
  /** 保留旧宿主的 Chokidar 原子保存配置；业务仍按最终状态消费批量通知。 */
  atomic?: boolean | number
  recoverRenames?: boolean
}

export interface FileWatchChange {
  event: 'create' | 'update' | 'delete'
  file: string
  kind: 'file' | 'directory'
  initial?: boolean
  source?: 'rename'
}

export interface FileWatcher {
  ready: Promise<FileWatchReadiness>
  add: (targets: FileWatchTargets) => Promise<FileWatchReadiness>
  updateTargets: (targets: FileWatchTargets) => Promise<FileWatchReadiness>
  onChange: (listener: (changes: FileWatchChange[]) => void) => () => void
  onError: (listener: (error: unknown) => void) => () => void
  close: () => Promise<void>
}
