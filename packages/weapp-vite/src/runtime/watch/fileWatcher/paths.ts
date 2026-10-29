import type { Stats } from 'node:fs'
import type { FileWatchOptions, FileWatchTargets } from './types'
import path from 'pathe'
import picomatch from 'picomatch'
import { normalizePath } from '../../../utils/path'

export function resolveWatchPath(file: string) {
  const normalized = normalizePath(file)
  return path.isAbsolute(normalized) ? normalized : path.resolve(normalized)
}

export function normalizeWatchTargets(targets: FileWatchTargets) {
  return [...new Set((Array.isArray(targets) ? targets : [targets]).map(resolveWatchPath))]
}

export function containsWatchPath(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
}

export function createFileWatchIgnored(ignored: FileWatchOptions['ignored']) {
  const matchers = (ignored === undefined ? [] : Array.isArray(ignored) ? ignored : [ignored]).map((matcher) => {
    if (typeof matcher === 'function') {
      return matcher
    }
    if (matcher instanceof RegExp) {
      return (file: string) => {
        matcher.lastIndex = 0
        return matcher.test(file)
      }
    }
    const match = picomatch(matcher, { dot: true })
    const literal = resolveWatchPath(matcher)
    return (file: string) => containsWatchPath(literal, file) || match(file)
  })
  return (file: string, stats?: Stats) => matchers.some(matcher => matcher(file, stats))
}
