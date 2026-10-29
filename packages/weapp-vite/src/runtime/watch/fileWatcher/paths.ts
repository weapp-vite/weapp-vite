import type { Stats } from 'node:fs'
import type { FileWatchOptions, FileWatchTargets } from './types'
import path from 'pathe'
import picomatch from 'picomatch'

export function normalizeWatchTargets(targets: FileWatchTargets) {
  return [...new Set((Array.isArray(targets) ? targets : [targets]).map(file => path.resolve(file)))]
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
    const literal = path.resolve(matcher)
    return (file: string) => containsWatchPath(literal, file) || match(file)
  })
  return (file: string, stats?: Stats) => matchers.some(matcher => matcher(file, stats))
}
