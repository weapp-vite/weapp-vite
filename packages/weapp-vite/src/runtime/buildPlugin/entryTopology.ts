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

function collectEntryConfigs(ctx: MutableCompilerContext) {
  const entryConfigs = new Map<string, unknown>()
  for (const entry of ctx.runtimeState?.build.hmr.entriesMap.values() ?? []) {
    if (!entry) {
      continue
    }
    if (entry.jsonPath) {
      entryConfigs.set(normalizeFsResolvedId(entry.jsonPath), entry.declaredJson ?? entry.json)
    }
    const basename = normalizeFsResolvedId(entry.path).replace(/\.[^/.]+$/, '')
    for (const extension of ['.json', '.json.js', '.json.ts']) {
      const candidate = `${basename}${extension}`
      if (!entryConfigs.has(candidate)) {
        entryConfigs.set(candidate, undefined)
      }
    }
  }
  return entryConfigs
}

/** 冻结已发布完整扫描的入口拓扑，局部资源构建不得推进此基线。 */
export function captureEntryTopology(ctx: MutableCompilerContext) {
  return new Map([...collectEntryConfigs(ctx)].map(([file, value]) => [file, entryTopologySignature(value)]))
}

export async function hasEntryTopologyChange(
  ctx: MutableCompilerContext,
  files: Iterable<string>,
  committed?: ReadonlyMap<string, string>,
  deletedFiles?: ReadonlySet<string>,
) {
  if (!ctx.jsonService) {
    return false
  }
  const entryConfigs = collectEntryConfigs(ctx)
  let changed = false
  for (const file of files) {
    if (!/\.json(?:\.[jt]s)?$/.test(file)) {
      continue
    }
    const cached = ctx.jsonService.cache.get(file) as unknown
    const normalizedFile = normalizeFsResolvedId(file)
    const before = cached === undefined ? entryConfigs.get(normalizedFile) : cached
    // 外部转换输入即使是 JSON，也不属于入口配置；解析、错误恢复由声明它的转换器负责。
    if (before === undefined && !entryConfigs.has(normalizedFile) && !committed?.has(normalizedFile)) {
      continue
    }
    // 结构删除表示配置不存在，不应交给 JSON 解析器报告语法错误。
    const after = deletedFiles?.has(normalizedFile) ? undefined : await ctx.jsonService.read(file) as unknown
    if ((committed?.get(normalizedFile) ?? entryTopologySignature(before)) !== entryTopologySignature(after)) {
      changed = true
    }
  }
  return changed
}
