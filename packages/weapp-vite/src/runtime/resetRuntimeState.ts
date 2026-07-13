import type { RuntimeState } from './runtimeState'
import { createRuntimeState } from './runtimeState'

export function resetRuntimeStateForFreshBuild(runtimeState: RuntimeState): void {
  const fresh = createRuntimeState()

  const autoRoutes = runtimeState.autoRoutes
  autoRoutes.routes = fresh.autoRoutes.routes
  autoRoutes.serialized = fresh.autoRoutes.serialized
  autoRoutes.moduleCode = fresh.autoRoutes.moduleCode
  autoRoutes.typedDefinition = fresh.autoRoutes.typedDefinition
  autoRoutes.watchFiles.clear()
  autoRoutes.watchDirs.clear()
  autoRoutes.dirty = fresh.autoRoutes.dirty
  autoRoutes.initialized = fresh.autoRoutes.initialized
  autoRoutes.candidates.clear()
  autoRoutes.needsFullRescan = fresh.autoRoutes.needsFullRescan
  autoRoutes.loadingAppConfig = fresh.autoRoutes.loadingAppConfig

  const autoImport = runtimeState.autoImport
  autoImport.registry.clear()
  autoImport.resolvedResolverComponents.clear()
  autoImport.matcher = undefined
  autoImport.matcherKey = fresh.autoImport.matcherKey
  autoImport.version += 1
  autoImport.pendingEntriesByImporter.clear()

  runtimeState.build.hmr = fresh.build.hmr

  const json = runtimeState.json
  json.cache.cache.clear()
  json.cache.mtimeMap.clear()
  json.cache.signatureMap.clear()
  json.emittedSource.clear()

  const asset = runtimeState.asset
  asset.emittedBuffer.clear()
  asset.scopedSlotGenerics.clear()

  const css = runtimeState.css
  css.importerToDependencies.clear()
  css.dependencyToImporters.clear()
  css.emittedSource.clear()

  const wxml = runtimeState.wxml
  wxml.depsMap.clear()
  wxml.importerMap.clear()
  wxml.tokenMap.clear()
  wxml.componentsMap.clear()
  wxml.aggregatedComponentsMap.clear()
  wxml.templatePathMap.clear()
  wxml.cache.cache.clear()
  wxml.cache.mtimeMap.clear()
  wxml.cache.signatureMap.clear()
  wxml.emittedCode.clear()

  const scan = runtimeState.scan
  scan.subPackageMap.clear()
  scan.independentSubPackageMap.clear()
  scan.warnedMessages.clear()
  scan.appEntry = undefined
  scan.pluginJson = undefined
  scan.pluginJsonPath = undefined
  scan.isDirty = fresh.scan.isDirty
  scan.independentDirtyRoots.clear()

  const lib = runtimeState.lib
  lib.enabled = fresh.lib.enabled
  lib.entries.clear()
}
