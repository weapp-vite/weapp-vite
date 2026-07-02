import type { MutableCompilerContext } from '../../../context'
import type { ComponentsMap } from '../../../types'
import type { ScanWxmlResult } from '../../../wxml'
import { removeExtensionDeep } from '@weapp-core/shared'

export type WxmlDependencyKind = 'template-import' | 'template-include' | 'script-module' | 'unknown'
export type WxmlImporterDependencyKind = WxmlDependencyKind | 'mixed'

export interface WxmlServiceState {
  ctx: MutableCompilerContext
  depsMap: Map<string, Set<string>>
  importerMap: Map<string, Set<string>>
  depKindMap: Map<string, Map<string, Set<WxmlDependencyKind>>>
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
    depKindMap,
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
    depKindMap,
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

export function linkImporter(
  state: WxmlServiceState,
  dep: string,
  importer: string,
  kind: WxmlDependencyKind = 'unknown',
) {
  let importers = state.importerMap.get(dep)
  if (!importers) {
    importers = new Set<string>()
    state.importerMap.set(dep, importers)
  }
  importers.add(importer)

  let importerKinds = state.depKindMap.get(dep)
  if (!importerKinds) {
    importerKinds = new Map<string, Set<WxmlDependencyKind>>()
    state.depKindMap.set(dep, importerKinds)
  }
  let kinds = importerKinds.get(importer)
  if (!kinds) {
    kinds = new Set<WxmlDependencyKind>()
    importerKinds.set(importer, kinds)
  }
  kinds.add(kind)
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

  const importerKinds = state.depKindMap.get(dep)
  if (!importerKinds) {
    return
  }
  importerKinds.delete(importer)
  if (importerKinds.size === 0) {
    state.depKindMap.delete(dep)
  }
}

export function getImporterDependencyKind(
  state: WxmlServiceState,
  dep: string,
  importer: string,
): WxmlImporterDependencyKind | undefined {
  const kinds = state.depKindMap.get(dep)?.get(importer)
  if (!kinds?.size) {
    return undefined
  }
  if (kinds.size === 1) {
    return Array.from(kinds)[0]
  }
  return 'mixed'
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
