import type { Stats } from 'node:fs'
import type { FileWatchChange, FileWatchOptions } from './types'
import { lstat, readdir, readlink, realpath, stat } from 'node:fs/promises'
import path from 'pathe'
import { isMissingWatchPath } from '../../../src/runtime/watch/fileWatcher/errors'
import { containsWatchPath, createFileWatchIgnored } from '../../../src/runtime/watch/fileWatcher/paths'

export interface WatchPathMapping {
  physical: string
  logical: string
}

export interface FileWatchRecord {
  file: string
  physical: string
  kind: FileWatchChange['kind']
  signature: string
  stats: Stats
}

export interface FileWatchSnapshot {
  records: Map<string, FileWatchRecord>
  mappings: WatchPathMapping[]
}

/** 缺失目标沿现存祖先恢复真实路径，符号链接仍保留独立的逻辑入口映射。 */
export async function resolveWatchPhysicalPath(file: string, links = 0): Promise<string> {
  if (links > 40) {
    throw new Error(`File watcher encountered a symbolic link cycle: ${file}`)
  }
  try {
    return path.normalize(await realpath(file))
  }
  catch (error) {
    if (!isMissingWatchPath(error)) {
      throw error
    }
  }
  try {
    const value = await readlink(file)
    return await resolveWatchPhysicalPath(path.resolve(path.dirname(file), value), links + 1)
  }
  catch (error) {
    if (!isMissingWatchPath(error) && !(error && typeof error === 'object' && 'code' in error && error.code === 'EINVAL')) {
      throw error
    }
  }
  const parent = path.dirname(file)
  if (parent === file) {
    return file
  }
  return path.join(await resolveWatchPhysicalPath(parent, links), path.basename(file))
}

export async function createWatchMappings(targets: string[]) {
  const mappings: WatchPathMapping[] = []
  for (const logical of targets) {
    const physical = await resolveWatchPhysicalPath(logical)
    mappings.push({ physical, logical })
    const entry = path.join(await resolveWatchPhysicalPath(path.dirname(logical)), path.basename(logical))
    if (entry !== physical) {
      mappings.push({ physical: entry, logical })
    }
  }
  return mappings
}

export async function scanFileWatchTargets(targets: string[], options: FileWatchOptions, signal: AbortSignal): Promise<FileWatchSnapshot> {
  const ignored = createFileWatchIgnored(options.ignored)
  const records = new Map<string, FileWatchRecord>()
  const mappings = await createWatchMappings(targets)
  const visit = async (file: string, depth: number, parents: Set<string>): Promise<void> => {
    if (signal.aborted) {
      return
    }
    let stats: Stats
    let symbolic = false
    try {
      stats = await lstat(file)
      symbolic = stats.isSymbolicLink()
      if (symbolic) {
        const linked = await resolveWatchPhysicalPath(file)
        mappings.push({ physical: linked, logical: file })
        stats = await stat(file)
      }
    }
    catch (error) {
      if (isMissingWatchPath(error)) {
        return
      }
      throw error
    }
    if (signal.aborted || ignored(file, stats)) {
      return
    }
    const physical = await resolveWatchPhysicalPath(file)
    const kind = stats.isDirectory() ? 'directory' : 'file'
    records.set(file, {
      file,
      physical,
      kind,
      stats,
      signature: `${stats.mtimeMs}:${stats.ctimeMs}:${stats.size}:${stats.ino}:${stats.mode}`,
    })
    if (kind !== 'directory' || parents.has(physical) || (options.depth !== undefined && depth > options.depth)) {
      return
    }
    const nextParents = new Set([...parents, physical])
    let entries: string[]
    try {
      entries = await readdir(file)
    }
    catch (error) {
      if (isMissingWatchPath(error)) {
        records.delete(file)
        return
      }
      throw error
    }
    for (const name of entries) {
      await visit(path.join(file, name), depth + 1, nextParents)
    }
  }
  for (const target of targets) {
    await visit(target, 0, new Set())
  }
  const uniqueMappings = new Map(mappings.map(mapping => [`${mapping.physical}\0${mapping.logical}`, mapping]))
  return { records, mappings: [...uniqueMappings.values()] }
}

export function watchMappingMatches(mappings: WatchPathMapping[], physical: string) {
  return mappings.some(mapping => containsWatchPath(mapping.physical, physical) || containsWatchPath(physical, mapping.physical))
}

export function diffFileWatchSnapshots(previous: Map<string, FileWatchRecord>, next: Map<string, FileWatchRecord>, initial: boolean, ignoreInitial: boolean) {
  const changes: FileWatchChange[] = []
  for (const [file, record] of previous) {
    if (!next.has(file)) {
      changes.push({ event: 'delete', file, kind: record.kind })
    }
  }
  for (const [file, record] of next) {
    const before = previous.get(file)
    if (before && before.kind !== record.kind) {
      changes.push({ event: 'delete', file, kind: before.kind })
    }
    if (!before || before.kind !== record.kind) {
      if (!initial || !ignoreInitial) {
        changes.push({ event: 'create', file, kind: record.kind, ...(initial ? { initial: true } : {}) })
      }
    }
    else if (record.kind === 'file' && record.signature !== before.signature) {
      changes.push({ event: 'update', file, kind: record.kind })
    }
  }
  return changes
}
