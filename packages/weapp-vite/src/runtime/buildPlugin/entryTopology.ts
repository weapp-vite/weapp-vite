import type { MutableCompilerContext } from '../../context'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

const fields = ['pages', 'subPackages', 'subpackages', 'usingComponents', 'componentGenerics', 'component', 'tabBar', 'appBar', 'plugins'] as const

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
  }
  return value
}

/** 只比较决定入口可达性的字段；普通标题等配置仍沿用局部资源更新。 */
export function entryTopologySignature(value: unknown) {
  const config = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return JSON.stringify(canonical(Object.fromEntries(fields.map(field => [field, config[field]]))))
}

export async function hasEntryTopologyChange(ctx: MutableCompilerContext, files: Iterable<string>) {
  if (!ctx.jsonService) {
    return false
  }
  const entryConfigPaths = new Set<string>()
  for (const entry of ctx.runtimeState?.build.hmr.entriesMap.values() ?? []) {
    if (!entry) {
      continue
    }
    if (entry.jsonPath) {
      entryConfigPaths.add(normalizeFsResolvedId(entry.jsonPath))
    }
    const basename = normalizeFsResolvedId(entry.path).replace(/\.[^/.]+$/, '')
    for (const extension of ['.json', '.json.js', '.json.ts']) {
      entryConfigPaths.add(`${basename}${extension}`)
    }
  }
  let changed = false
  for (const file of files) {
    if (!/\.json(?:\.[jt]s)?$/.test(file)) {
      continue
    }
    const before = ctx.jsonService.cache.get(file) as unknown
    // 外部转换输入即使是 JSON，也不属于入口配置；解析、错误恢复由声明它的转换器负责。
    if (before === undefined && !entryConfigPaths.has(normalizeFsResolvedId(file))) {
      continue
    }
    const after = await ctx.jsonService.read(file) as unknown
    if (entryTopologySignature(before) !== entryTopologySignature(after)) {
      changed = true
    }
  }
  return changed
}
