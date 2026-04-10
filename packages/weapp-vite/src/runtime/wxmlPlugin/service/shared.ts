import type { MutableCompilerContext } from '../../../context'
import type { ComponentsMap } from '../../../types'
import type { ScanWxmlResult } from '../../../wxml'
import { removeExtensionDeep } from '@weapp-core/shared'

export interface WxmlServiceState {
  ctx: MutableCompilerContext
  depsMap: Map<string, Set<string>>
  importerMap: Map<string, Set<string>>
  tokenMap: Map<string, ScanWxmlResult>
  componentsMap: Map<string, ComponentsMap>
  aggregatedComponentsMap: Map<string, ComponentsMap>
  autoImportComponentsMap: Map<string, ComponentsMap>
  aggregatedAutoImportComponentsMap: Map<string, ComponentsMap>
  templatePathMap: Map<string, string>
  cache: MutableCompilerContext['runtimeState']['wxml']['cache']
  emittedCode: Map<string, string>
}

export function createWxmlServiceState(ctx: MutableCompilerContext): WxmlServiceState {
  const {
    depsMap,
    importerMap,
    tokenMap,
    componentsMap,
    aggregatedComponentsMap,
    templatePathMap,
    cache,
    emittedCode,
  } = ctx.runtimeState.wxml

  return {
    ctx,
    depsMap,
    importerMap,
    tokenMap,
    componentsMap,
    aggregatedComponentsMap,
    autoImportComponentsMap: new Map<string, ComponentsMap>(),
    aggregatedAutoImportComponentsMap: new Map<string, ComponentsMap>(),
    templatePathMap,
    cache,
    emittedCode,
  }
}

export function linkImporter(state: WxmlServiceState, dep: string, importer: string) {
  let importers = state.importerMap.get(dep)
  if (!importers) {
    importers = new Set<string>()
    state.importerMap.set(dep, importers)
  }
  importers.add(importer)
}

export function unlinkImporter(state: WxmlServiceState, dep: string, importer: string) {
  const importers = state.importerMap.get(dep)
  if (!importers) {
    return
  }
  importers.delete(importer)
  if (importers.size === 0) {
    state.importerMap.delete(dep)
  }
}

export function invalidateAggregatedComponents(
  state: WxmlServiceState,
  filepath: string,
  targetMap: Map<string, ComponentsMap>,
  visited = new Set<string>(),
) {
  if (visited.has(filepath)) {
    return
  }
  visited.add(filepath)
  targetMap.delete(removeExtensionDeep(filepath))
  const importers = state.importerMap.get(filepath)
  if (!importers) {
    return
  }
  for (const importer of importers) {
    invalidateAggregatedComponents(state, importer, targetMap, visited)
  }
}
