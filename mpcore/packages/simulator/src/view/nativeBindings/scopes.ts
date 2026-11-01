import type { WxsModuleBindings } from '../wxs'
import type { TemplateValueSource } from './sources'
import { wxsScopeData } from '../wxs'
import { captureTemplateReads } from './reads'
import { copyTemplatePropertySources, setTemplateMissingSources, setTemplatePropertySources } from './sources'

interface BindingScope {
  data: Record<string, any>
  dataOwner?: { data: Record<string, any> }
  wxs?: WxsModuleBindings
}

/** 在原有求值过程中记录来源，不重复执行表达式或把标量装箱。 */
export function resolveNativeScopeValue<T>(scope: BindingScope, read: (source: Record<string, any>) => T) {
  const source = wxsScopeData(scope)
  return scope.dataOwner
    ? captureTemplateReads(source, scope.dataOwner.data, () => read(source))
    : { value: read(source), paths: [], propertySource: (_key: string | number): TemplateValueSource => ({ paths: [] }) }
}

export function createNativeLoopData(
  scope: BindingScope,
  itemName: string,
  indexName: string,
  item: unknown,
  index: string | number,
  itemSource: TemplateValueSource,
  indexPaths: string[][],
) {
  const data = { ...scope.data, [indexName]: index, [itemName]: item }
  copyTemplatePropertySources(data, scope.data)
  if (scope.dataOwner) {
    setTemplatePropertySources(data, indexName, scope.dataOwner.data, { paths: indexPaths })
    setTemplatePropertySources(data, itemName, scope.dataOwner.data, itemSource)
  }
  return data
}

export function resolveNativeTemplateData(scope: BindingScope, read: (source: Record<string, any>) => Record<string, any>) {
  const result = resolveNativeScopeValue(scope, read)
  const data = { ...result.value }
  if (scope.dataOwner) {
    setTemplateMissingSources(data, scope.dataOwner.data, result.propertySource)
    for (const key of Object.keys(data)) {
      setTemplatePropertySources(data, key, scope.dataOwner.data, result.propertySource(key))
    }
  }
  return data
}
