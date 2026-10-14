import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'
import path from 'node:path'
import { types } from 'node:util'
import { resolveSourceScanPathWithApi, sourcePathApi, toPosixPath } from '@weapp-tailwindcss/source-scan'
// eslint-disable-next-line e18e/ban-dependencies -- 保持已安装上游 micromatch 的 glob、隐藏文件及异常语义。
import micromatch from 'micromatch'
import { compactTailwindSourceEntries } from './compact'

type SourceEntry = CompilerGenerateResult['sources'][number]
type SourceMatcher = (file: string, entries: SourceEntry[]) => boolean

/** 检查不执行访问器；不明对象仍由上游读取并保持原异常顺序。 */
function hasPlainEntries(entries: SourceEntry[]): boolean {
  if (types.isProxy(entries) || !Array.isArray(entries) || Object.getPrototypeOf(entries) !== Array.prototype
    || Reflect.ownKeys(entries).some(key => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/.test(key)))) {
    return false
  }
  for (let index = 0; index < entries.length; index++) {
    const item = Object.getOwnPropertyDescriptor(entries, String(index))
    if (!item || !('value' in item)) {
      return false
    }
    const entry = item.value
    if (!entry || typeof entry !== 'object' || types.isProxy(entry)) {
      return false
    }
    const prototype = Object.getPrototypeOf(entry)
    if (prototype !== null && prototype !== Object.prototype) {
      return false
    }
    const descriptors = Object.getOwnPropertyDescriptors(entry)
    // 合并规则会 spread 条目，附加字段和 Symbol 访问器也必须原样回退。
    if (Reflect.ownKeys(entry).some(key => !('value' in Object.getOwnPropertyDescriptor(entry, key)!))) {
      return false
    }
    if (typeof descriptors.base?.value !== 'string' || typeof descriptors.pattern?.value !== 'string'
      || typeof descriptors.negated?.value !== 'boolean') {
      return false
    }
  }
  return true
}

/** 绝对模式沿上游词法 base 归一化；不能替换成真实路径 base。 */
function normalizePattern(entry: SourceEntry): string {
  const windows = /^[a-z]:[\\/]/i.test(entry.base) || entry.base.includes('\\') || /^[a-z]:[\\/]/i.test(entry.pattern)
  const pathApi = windows ? path.win32 : sourcePathApi(entry.base)
  return pathApi.isAbsolute(entry.pattern)
    ? toPosixPath(pathApi.relative(pathApi.resolve(entry.base), entry.pattern))
    : windows ? toPosixPath(entry.pattern) : entry.pattern
}

/** 每文件刷新真实路径，仅复用本批次与文件系统无关的延迟 glob 编译。 */
export function createTailwindSourceMatcher(original: SourceMatcher): SourceMatcher {
  const patterns = new Map<string, (file: string) => boolean>()
  return (file, entries) => {
    if (typeof file !== 'string' || !hasPlainEntries(entries) || !entries.length) {
      return original(file, entries)
    }
    const sources = compactTailwindSourceEntries(entries)
    const resolvedFile = resolveSourceScanPathWithApi(file, sourcePathApi(file, ...sources.map(entry => entry.base)))
    const bases = new Map<typeof path, Map<string, string>>()
    const matches = (entry: SourceEntry) => {
      const pathApi = sourcePathApi(entry.base, resolvedFile)
      let paths = bases.get(pathApi)
      if (!paths) {
        paths = new Map()
        bases.set(pathApi, paths)
      }
      let base = paths.get(entry.base)
      if (base === undefined) {
        base = resolveSourceScanPathWithApi(entry.base, pathApi)
        paths.set(entry.base, base)
      }
      const relative = toPosixPath(pathApi.relative(base, resolvedFile))
      if (!relative || relative.startsWith('../') || pathApi.isAbsolute(relative)) {
        return false
      }
      const pattern = normalizePattern(entry)
      let match = patterns.get(pattern)
      if (!match) {
        match = micromatch.matcher(pattern)
        patterns.set(pattern, match)
      }
      return match(relative)
    }
    const positive = sources.filter(entry => !entry.negated)
    const negative = sources.filter(entry => entry.negated)
    return positive.some(matches) && !negative.some(matches)
  }
}
