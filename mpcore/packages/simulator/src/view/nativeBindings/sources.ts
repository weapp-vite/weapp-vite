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

/** 别名来源独立于业务值保存；不同组件的数据根不会共用父实例的路径。 */
export function setTemplatePropertySources(target: object, key: string | number, root: object, value: TemplateValueSource) {
  let entry = sources.get(target)
  if (entry?.root !== root) {
    entry = { root, fields: new Map() }
    sources.set(target, entry)
  }
  entry.fields.set(String(key), value)
}

export function getTemplatePropertySources(target: object, key: string | number, root: object) {
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
  const entry = sources.get(source)
  if (entry) {
    sources.set(target, {
      root: entry.root,
      fields: new Map([...entry.fields].filter(([key]) => !excluded.includes(key))),
      missing: entry.missing && (key => excluded.includes(key) ? { paths: [] } : entry.missing!(key)),
    })
  }
}
