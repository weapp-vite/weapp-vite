import type { FSWatcher } from 'chokidar'
import type { Stats } from 'node:fs'
import type { FileWatchChange } from './types'
import fs from 'node:fs'
import path from 'pathe'

/** 仅兼容旧侧车的未覆盖目录 rename；已覆盖目录继续由 Chokidar 协调。 */
export function observeChokidarRenames(
  watcher: FSWatcher,
  root: string,
  ignored: (file: string, stats?: Stats) => boolean,
  emit: (change: FileWatchChange) => void,
  isReady: () => boolean,
) {
  const known = new Set<string>()
  const directories = new Set<string>()
  const deletedBeforeReady = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let closed = false
  const observe = (change: FileWatchChange) => {
    const timer = timers.get(change.file)
    if (timer) {
      clearTimeout(timer)
      timers.delete(change.file)
    }
    if (change.kind === 'directory') {
      if (change.event === 'delete') {
        for (const directory of directories) {
          if (directory === change.file || directory.startsWith(`${change.file}/`)) {
            directories.delete(directory)
          }
        }
      }
      else {
        directories.add(change.file)
      }
      return
    }
    if (change.event === 'delete') {
      if (!isReady() && known.has(change.file)) {
        deletedBeforeReady.add(change.file)
      }
      known.delete(change.file)
    }
    else {
      if (change.event === 'create' && deletedBeforeReady.has(change.file)) {
        change.initial = false
      }
      deletedBeforeReady.delete(change.file)
      known.add(change.file)
    }
  }
  const onRaw = (event: string, rawPath: unknown, details: unknown) => {
    if (closed || event !== 'rename' || rawPath === null || rawPath === undefined) {
      return
    }
    const candidate = String(rawPath)
    if (!candidate) {
      return
    }
    const base = details && typeof details === 'object' && 'watchedPath' in details && typeof details.watchedPath === 'string'
      ? details.watchedPath
      : root
    const file = path.resolve(base, candidate)
    if (ignored(file) || directories.has(path.dirname(file))) {
      return
    }
    const previous = timers.get(file)
    if (previous) {
      clearTimeout(previous)
    }
    timers.set(file, setTimeout(() => {
      timers.delete(file)
      if (closed || directories.has(path.dirname(file))) {
        return
      }
      const exists = fs.existsSync(file)
      const stats = exists && typeof fs.statSync === 'function' ? fs.statSync(file, { throwIfNoEntry: false }) : undefined
      if (ignored(file, stats) || stats?.isDirectory()) {
        return
      }
      const event = exists ? known.has(file) || isReady() ? 'update' : 'create' : known.has(file) ? 'delete' : undefined
      if (event) {
        const change: FileWatchChange = { event, file, kind: 'file', source: 'rename', initial: event === 'create' && !isReady() }
        observe(change)
        emit(change)
      }
    }, 120))
  }
  watcher.on('raw', onRaw)
  return {
    observe,
    close() {
      closed = true
      watcher.off?.('raw', onRaw)
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
      known.clear()
      directories.clear()
      deletedBeforeReady.clear()
    },
  }
}
