import type { FileWatchSnapshot, WatchPathMapping } from './scan'
import type { FileWatchOptions } from './types'
import { stat } from 'node:fs/promises'
import path from 'pathe'
import { isMissingWatchPath } from '../../../src/runtime/watch/fileWatcher/errors'
import { containsWatchPath, createFileWatchIgnored } from '../../../src/runtime/watch/fileWatcher/paths'
import { scanFileWatchTargets } from './scan'

interface ScanScope {
  logical: string
  depth: number | undefined
}

function eventScopes(targets: string[], mappings: WatchPathMapping[], touched: Set<string>, depth: number | undefined) {
  const scopes = new Map<string, ScanScope>()
  for (const physical of touched) {
    for (const mapping of mappings) {
      const logical = containsWatchPath(mapping.physical, physical)
        ? path.join(mapping.logical, path.relative(mapping.physical, physical))
        : containsWatchPath(physical, mapping.physical)
          ? mapping.logical
          : undefined
      if (!logical) {
        continue
      }
      for (const target of targets) {
        if (!containsWatchPath(target, logical)) {
          continue
        }
        const level = path.relative(target, logical).split('/').filter(Boolean).length
        if (depth !== undefined && level > depth + 1) {
          continue
        }
        const remaining = depth === undefined ? undefined : depth - level
        const previous = scopes.get(logical)
        if (!previous || (remaining ?? Infinity) > (previous.depth ?? Infinity)) {
          scopes.set(logical, { logical, depth: remaining })
        }
      }
    }
  }
  return [...scopes.values()]
}

function coveredByScope(scope: ScanScope, file: string) {
  if (!containsWatchPath(scope.logical, file)) {
    return false
  }
  const level = path.relative(scope.logical, file).split('/').filter(Boolean).length
  return scope.depth === undefined || level <= scope.depth + 1
}

function mergeWatchMappings(retained: WatchPathMapping[], added: WatchPathMapping[]) {
  const mappings = [...retained]
  for (const mapping of added) {
    if (!mappings.some(existing => containsWatchPath(existing.logical, mapping.logical)
      && path.join(existing.physical, path.relative(existing.logical, mapping.logical)) === mapping.physical)) {
      mappings.push(mapping)
    }
  }
  return mappings
}

async function hasVisibleAncestor(scope: ScanScope, targets: string[], options: FileWatchOptions) {
  if (!options.ignored) {
    return true
  }
  const ignored = createFileWatchIgnored(options.ignored)
  for (const target of targets.filter(target => containsWatchPath(target, scope.logical))) {
    let visible = true
    for (let ancestor = path.dirname(scope.logical); containsWatchPath(target, ancestor); ancestor = path.dirname(ancestor)) {
      try {
        if (ignored(ancestor, await stat(ancestor))) {
          visible = false
          break
        }
      }
      catch (error) {
        if (!isMissingWatchPath(error)) {
          throw error
        }
        if (ignored(ancestor)) {
          visible = false
          break
        }
      }
      if (ancestor === target) {
        break
      }
    }
    if (visible) {
      return true
    }
  }
  return false
}

/** 普通保存只协调事件命中的文件或目录；完整树扫描仅用于首次订阅与拓扑恢复。 */
export async function reconcileFileWatchBatch(
  previous: FileWatchSnapshot,
  targets: string[],
  touched: Set<string>,
  options: FileWatchOptions,
  signal: AbortSignal,
): Promise<FileWatchSnapshot> {
  const candidates = eventScopes(targets, previous.mappings, touched, options.depth)
  const scopes: ScanScope[] = []
  for (const scope of candidates) {
    if (await hasVisibleAncestor(scope, targets, options)) {
      scopes.push(scope)
    }
  }
  const records = new Map(previous.records)
  let mappings = previous.mappings.filter(mapping => !scopes.some(scope => coveredByScope(scope, mapping.logical)))
  for (const scope of scopes) {
    for (const file of records.keys()) {
      if (coveredByScope(scope, file)) {
        records.delete(file)
      }
    }
    const snapshot = await scanFileWatchTargets([scope.logical], { ...options, depth: scope.depth }, signal)
    for (const [file, record] of snapshot.records) {
      records.set(file, record)
    }
    mappings = mergeWatchMappings(mappings, snapshot.mappings)
  }
  return { records, mappings }
}
