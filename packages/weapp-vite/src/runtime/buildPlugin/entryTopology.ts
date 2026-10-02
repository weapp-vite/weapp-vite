import type { MutableCompilerContext } from '../../context'

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
  let changed = false
  for (const file of files) {
    if (!/\.json(?:\.[jt]s)?$/.test(file)) {
      continue
    }
    const before = ctx.jsonService.cache.get(file) as unknown
    const after = await ctx.jsonService.read(file) as unknown
    if (entryTopologySignature(before) !== entryTopologySignature(after)) {
      changed = true
    }
  }
  return changed
}
