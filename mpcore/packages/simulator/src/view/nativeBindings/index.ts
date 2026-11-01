import type { WxsModuleBindings } from '../wxs'
import { wxsScopeData } from '../wxs'
import { getNativeDataRevision, hasNativeDataCommit } from './commits'
import { captureTemplateReads } from './reads'

interface NativeBinding {
  owner: object
  revision: number
  paths: readonly string[][]
}

interface NativeBindingScope {
  data: Record<string, any>
  dataOwner?: { data: Record<string, any> }
  wxs?: WxsModuleBindings
}

const bindings = new WeakMap<object, NativeBinding>()

/** 原生受控属性保留实例归属与求值依赖，序列化值仍由现有 renderer 负责。 */
export function resolveNativeAttributeValue<T>(
  node: { name?: string },
  name: string,
  scope: NativeBindingScope,
  read: (source: Record<string, any>) => T,
) {
  const source = wxsScopeData(scope)
  if (node.name !== 'scroll-view' || name !== 'refresher-triggered' || !scope.dataOwner) {
    return read(source)
  }
  const result = captureTemplateReads(source, scope.dataOwner.data, () => read(source))
  bindings.set(node, { owner: scope.dataOwner, revision: getNativeDataRevision(scope.dataOwner), paths: result.paths })
  return result.value
}

export function getNativeBindingCommit(node: object, previous?: { owner: object, revision: number }) {
  const binding = bindings.get(node)
  if (!binding) {
    return { explicit: false, consumed: previous }
  }
  const after = previous?.owner === binding.owner ? previous.revision : binding.revision
  return {
    explicit: hasNativeDataCommit(binding.owner, binding.paths, after, binding.revision),
    consumed: { owner: binding.owner, revision: binding.revision },
  }
}
