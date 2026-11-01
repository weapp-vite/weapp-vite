type Scope = Record<string, unknown>
type Reader = (scope: Scope) => unknown

export interface TemplateScopeSource {
  key?: string | Reader
  spread?: boolean
  index?: number
  read: Reader
  object?: readonly TemplateScopeSource[]
  consequent?: readonly TemplateScopeSource[]
  alternate?: readonly TemplateScopeSource[]
}

interface ScopeSources {
  parent: Scope
  sources: readonly TemplateScopeSource[]
}

const scopeSources = new WeakMap<object, ScopeSources>()

/** 来源跟随模板作用域，原始值不需要装箱，也不会进入业务数据。 */
export function registerTemplateScopeSources(scope: Scope, parent: Scope, sources: readonly TemplateScopeSource[] = []) {
  scopeSources.set(scope, { parent, sources })
}

export function resolveTemplateScopeSource(scope: Scope, key: string) {
  let owner: Scope | null = scope
  while (owner && !Object.prototype.hasOwnProperty.call(owner, key)) {
    owner = Object.getPrototypeOf(owner) as Scope | null
  }
  const metadata = owner && scopeSources.get(owner)
  if (!metadata) {
    return undefined
  }
  const select = (sources: readonly TemplateScopeSource[], field: string, actual: unknown, tracked: Scope): { found: boolean, value?: unknown } => {
    for (let index = sources.length - 1; index >= 0; index--) {
      const source = sources[index]!
      if (source.consequent && source.alternate) {
        const selected = select(source.read(tracked) ? source.consequent : source.alternate, field, actual, tracked)
        if (selected.found) {
          return selected
        }
      }
      if (source.spread) {
        const value = source.read(tracked)
        if (value && typeof value === 'object') {
          // 缺失的键也要读取：后续显式补入该键会改变 spread 的覆盖关系。
          const result = (value as Scope)[field]
          if (Object.prototype.hasOwnProperty.call(value, field)) {
            return { found: true, value: result }
          }
        }
      }
      else if ((typeof source.key === 'function' ? String(source.key(tracked)) : source.key) === field) {
        if (source.object && actual && typeof actual === 'object') {
          return {
            found: true,
            value: new Proxy(actual as Scope, {
              get(target, name, receiver) {
                const result = Reflect.get(target, name, receiver)
                if (typeof name !== 'string') {
                  return result
                }
                const nested = select(source.object!, name, result, tracked)
                return nested.found ? nested.value : result
              },
            }),
          }
        }
        const value = source.read(tracked)
        if (source.index === undefined) {
          return { found: true, value }
        }
        if (Array.isArray(value)) {
          return { found: true, value: value[source.index] }
        }
        if (value && typeof value === 'object') {
          const item = Object.keys(value)[source.index]
          return { found: true, value: item === undefined ? undefined : (value as Scope)[item] }
        }
        return { found: true, value: source.index }
      }
    }
    return { found: false }
  }
  const read: Reader = (tracked) => {
    const actual = owner![key]
    const selected = select(metadata.sources, key, actual, tracked)
    return selected.found ? selected.value : actual
  }
  return { scope: metadata.parent, read }
}
