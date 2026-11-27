import type { Stats } from 'node:fs'
import { realpathSync } from 'node:fs'
import nodePath from 'node:path'
import path from 'pathe'
import picomatch from 'picomatch'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

export interface BuildWatchFilterOptions {
  include?: string | RegExp | (string | RegExp)[] | null
  exclude?: string | RegExp | (string | RegExp)[] | null
  preserveSymlinks?: boolean
}

export interface BuildWatchFilter {
  accepts: (file: string) => boolean
  ignored: (file: string, stats?: Stats) => boolean
  targets: string[]
}

type AlwaysWatchFiles = Iterable<string> | (() => Iterable<string>)

interface CompiledPattern {
  negative: boolean
  matches: (file: string) => boolean
}

function posix(file: string) {
  return normalizeFsResolvedId(file).replaceAll('\\', '/')
}

function absolute(file: string, cwd: string) {
  return posix(path.isAbsolute(file) ? path.normalize(file) : path.resolve(cwd, file))
}

function contains(root: string, file: string) {
  const relative = path.relative(root, file)
  return relative === '' || (relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative))
}

function physicalPath(file: string) {
  let current = nodePath.resolve(file)
  const suffix: string[] = []
  while (true) {
    try {
      return posix(path.join(realpathSync.native(current), ...suffix))
    }
    catch {
      const parent = nodePath.dirname(current)
      if (parent === current) {
        return posix(file)
      }
      suffix.unshift(nodePath.basename(current))
      current = parent
    }
  }
}

function isNegatedPattern(pattern: string) {
  return pattern.startsWith('!') && !pattern.startsWith('!(')
}

function resolvePattern(pattern: string, cwd: string) {
  const negated = isNegatedPattern(pattern)
  const body = negated ? pattern.slice(1) : pattern
  const normalized = absolute(body, cwd)
  const scanned = picomatch.scan(normalized)
  const base = absolute(scanned.isGlob ? scanned.base || '.' : path.dirname(normalized), cwd)
  const suffix = normalized.slice(base.length)
  const physicalBase = physicalPath(base)
  const patterns = [...new Set([
    normalized,
    posix(path.join(physicalBase, suffix)),
    ...(body.startsWith('**') ? [body] : []),
  ])]
  return {
    patterns,
    roots: [...new Set([base, physicalBase])],
  }
}

function compilePattern(pattern: string | RegExp, cwd: string): CompiledPattern {
  if (pattern instanceof RegExp) {
    return {
      negative: false,
      matches(file) {
        pattern.lastIndex = 0
        return pattern.test(file)
      },
    }
  }
  const negated = isNegatedPattern(pattern)
  const matchers = resolvePattern(pattern, cwd).patterns.map(value => picomatch(value, { dot: true }))
  return {
    negative: negated,
    matches: file => matchers.some(match => match(file)),
  }
}

function asArray(value: string | RegExp | (string | RegExp)[] | null | undefined) {
  return value == null ? [] : Array.isArray(value) ? value : [value]
}

function lastMatchingPatternIndex(patterns: CompiledPattern[], aliases: string[]) {
  let index = -1
  for (const [patternIndex, pattern] of patterns.entries()) {
    if (aliases.some(pattern.matches)) {
      index = patternIndex
    }
  }
  return index
}

function matchesPatterns(patterns: CompiledPattern[], aliases: string[]) {
  const index = lastMatchingPatternIndex(patterns, aliases)
  return index >= 0 ? !patterns[index]!.negative : patterns.length > 0 && patterns.every(pattern => pattern.negative)
}

export function createBuildWatchFilter(
  options: BuildWatchFilterOptions | null | undefined,
  cwd: string,
  alwaysWatch: AlwaysWatchFiles = [],
): BuildWatchFilter {
  const include = asArray(options?.include)
  const exclude = asArray(options?.exclude)
  const includePatterns = include.map(pattern => compilePattern(pattern, cwd))
  const excludePatterns = exclude.map(pattern => compilePattern(pattern, cwd))
  const targets = [...new Set(include.flatMap((pattern) => {
    if (typeof pattern !== 'string' || isNegatedPattern(pattern)) {
      return []
    }
    return resolvePattern(pattern, cwd).roots.map(root => options?.preserveSymlinks ? root : physicalPath(root))
  }))]
  const hasRegExpInclude = include.some(pattern => pattern instanceof RegExp)
  let alwaysKey: string | undefined
  let always: Array<{ root: string, physicalRoot: string }> = []

  const aliases = (file: string) => {
    const normalized = absolute(file, cwd)
    return [normalized, physicalPath(normalized)]
  }
  const resolveAlways = () => {
    const files = typeof alwaysWatch === 'function' ? [...alwaysWatch()] : alwaysWatch
    const roots = [...new Set(Array.from(files, file => absolute(file, cwd)))]
    const key = roots.join('\0')
    if (key !== alwaysKey) {
      alwaysKey = key
      always = roots.map(root => ({ root, physicalRoot: physicalPath(root) }))
    }
  }
  const isAlwaysWatch = (file: string) => always.some(({ root, physicalRoot }) => contains(root, file) || contains(physicalRoot, file))
  const containsAlwaysWatch = (file: string) => always.some(({ root, physicalRoot }) => contains(file, root) || contains(file, physicalRoot))
  const isExcluded = (file: string) => matchesPatterns(excludePatterns, aliases(file))
  const isIncluded = (file: string) => includePatterns.length === 0 || matchesPatterns(includePatterns, aliases(file))

  return {
    accepts(file) {
      resolveAlways()
      const normalized = absolute(file, cwd)
      return isAlwaysWatch(normalized) || (!isExcluded(normalized) && isIncluded(normalized))
    },
    ignored(file, stats) {
      resolveAlways()
      const normalized = absolute(file, cwd)
      const fileAliases = aliases(normalized)
      if (isAlwaysWatch(normalized) || containsAlwaysWatch(normalized)) {
        return false
      }
      const excludedIndex = lastMatchingPatternIndex(excludePatterns, fileAliases)
      if (excludedIndex >= 0) {
        // 后续否定模式可能重新纳入后代，不能在此剪断 Chokidar 的目录遍历。
        return !excludePatterns.slice(excludedIndex + 1).some(pattern => pattern.negative)
      }
      if (includePatterns.length === 0) {
        return false
      }
      if (stats?.isDirectory() || (!stats && hasRegExpInclude)) {
        return false
      }
      if (!stats && fileAliases.some(alias => targets.some(target => contains(alias, target)))) {
        return false
      }
      return !matchesPatterns(includePatterns, fileAliases)
    },
    targets,
  }
}
