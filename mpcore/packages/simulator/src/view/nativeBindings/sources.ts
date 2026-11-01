export interface TemplateValueSource {
  paths: string[][]
  addresses?: string[][]
  fields?: Map<string, TemplateValueSource>
  missing?: (key: string) => TemplateValueSource
  controls?: string[][]
}

interface PropertySources {
  root: object
  fields: Map<string, TemplateValueSource>
  missing?: (key: string) => TemplateValueSource
}

const sources = new WeakMap<object, PropertySources>()
const excludedSources = new WeakMap<object, Set<string>>()

/** 别名来源独立于业务值保存；不同组件的数据根不会共用父实例的路径。 */
export function setTemplatePropertySources(target: object, key: string | number, root: object, value: TemplateValueSource) {
  excludedSources.get(target)?.delete(String(key))
  let entry = sources.get(target)
  if (entry?.root !== root) {
    entry = { root, fields: new Map() }
    sources.set(target, entry)
  }
  entry.fields.set(String(key), value)
}

export function getTemplatePropertySources(target: object, key: string | number, root: object): TemplateValueSource | undefined {
  if (excludedSources.get(target)?.has(String(key))) {
    return { paths: [] }
  }
  const entry = sources.get(target)
  return entry?.root === root ? entry.fields.get(String(key)) ?? entry.missing?.(String(key)) : undefined
}

export function getTemplateObjectSources(target: object, root: object) {
  const entry = sources.get(target)
  return entry?.root === root ? entry.fields : undefined
}

export function getTemplateMissingSources(target: object, root: object) {
  const entry = sources.get(target)
  return entry?.root === root ? entry.missing : undefined
}

export function setTemplateMissingSources(target: object, root: object, read: (key: string) => TemplateValueSource) {
  let entry = sources.get(target)
  if (entry?.root !== root) {
    entry = { root, fields: new Map() }
    sources.set(target, entry)
  }
  entry.missing = read
}

export function copyTemplatePropertySources(target: object, source: object, excluded: readonly string[] = []) {
  // WXS 覆盖名即使与页面值相等也没有页面来源；无既有 metadata 时也必须显式保留。
  const exclusions = new Set([...(excludedSources.get(source) ?? []), ...excluded])
  if (exclusions.size > 0) {
    excludedSources.set(target, exclusions)
  }
  const entry = sources.get(source)
  if (entry) {
    sources.set(target, {
      root: entry.root,
      fields: new Map([...entry.fields].filter(([key]) => !excluded.includes(key))),
      missing: entry.missing && (key => excluded.includes(key) ? { paths: [] } : entry.missing!(key)),
    })
  }
}
