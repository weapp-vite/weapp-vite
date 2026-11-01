import type { WxsModuleBindings } from '../wxs'
import { wxsScopeData } from '../wxs'
import { getNativeDataRevision, hasNativeDataCommit, recordNativeDataCommit } from './commits'
import { captureTemplateReads } from './reads'

interface Binding {
  owner: object
  revision: number
  paths: string[][]
}

interface BindingScope {
  data: Record<string, any>
  dataOwner?: { data: Record<string, any> }
  wxs?: WxsModuleBindings
}

const bindings = new WeakMap<object, Map<string, Binding>>()
const consumed = new WeakMap<object, Map<string, { owner: object, revision: number }>>()

export function resolveNativePropertyValue<T>(properties: object, key: string, scope: BindingScope, read: (source: Record<string, any>) => T) {
  const source = wxsScopeData(scope)
  if (!scope.dataOwner) {
    return read(source)
  }
  const result = captureTemplateReads(source, scope.dataOwner.data, () => read(source))
  let entries = bindings.get(properties)
  if (!entries) {
    entries = new Map()
    bindings.set(properties, entries)
  }
  entries.set(key, { owner: scope.dataOwner, revision: getNativeDataRevision(scope.dataOwner), paths: result.paths })
  return result.value
}

/** 属性仍由原有 observer 流程交付；此处只把显式同值命令延续到子实例。 */
export function syncNativePropertyCommits(instance: object, properties: object) {
  let previous = consumed.get(instance)
  if (!previous) {
    previous = new Map()
    consumed.set(instance, previous)
  }
  for (const [key, binding] of bindings.get(properties) ?? []) {
    const last = previous.get(key)
    previous.set(key, { owner: binding.owner, revision: binding.revision })
    if (last?.owner === binding.owner && hasNativeDataCommit(binding.owner, binding.paths, last.revision, binding.revision)) {
      recordNativeDataCommit(instance, [key])
    }
  }
}
