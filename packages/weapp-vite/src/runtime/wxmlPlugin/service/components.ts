import type { ComponentsMap } from '../../../types'
import type { WxmlServiceState } from './shared'
import { removeExtensionDeep } from '@weapp-core/shared'
import { isTemplate } from '../../../utils'
import { invalidateAggregatedComponents } from './shared'

function resolveTemplatePath(state: WxmlServiceState, filepathOrBaseName: string) {
  if (state.depsMap.has(filepathOrBaseName) || state.tokenMap.has(filepathOrBaseName)) {
    return filepathOrBaseName
  }
  if (state.templatePathMap.has(filepathOrBaseName)) {
    return state.templatePathMap.get(filepathOrBaseName)
  }
  return undefined
}

function getAggregatedComponentMap(
  state: WxmlServiceState,
  filepathOrBaseName: string,
  targetMap: Map<string, ComponentsMap>,
  resolveOwnComponents: (baseName: string) => ComponentsMap | undefined,
) {
  const templatePath = resolveTemplatePath(state, filepathOrBaseName)
  if (!templatePath) {
    return undefined
  }

  const baseName = removeExtensionDeep(templatePath)
  const cached = targetMap.get(baseName)
  if (cached) {
    return cached
  }

  const visited = new Set<string>()
  const aggregate = (filepath: string): ComponentsMap => {
    if (visited.has(filepath)) {
      return {}
    }
    visited.add(filepath)

    const currentBaseName = removeExtensionDeep(filepath)
    const merged: ComponentsMap = {}
    const own = resolveOwnComponents(currentBaseName)
    if (own) {
      for (const [name, ranges] of Object.entries(own)) {
        merged[name] = ranges
      }
    }

    const deps = state.depsMap.get(filepath)
    if (deps) {
      for (const dep of deps) {
        if (!isTemplate(dep)) {
          continue
        }
        const depComponents = aggregate(dep)
        for (const [name, ranges] of Object.entries(depComponents)) {
          if (!merged[name]) {
            merged[name] = ranges
          }
        }
      }
    }

    targetMap.set(currentBaseName, merged)
    return merged
  }

  return aggregate(templatePath)
}

export function createWxmlComponentService(state: WxmlServiceState) {
  function getAggregatedComponents(filepathOrBaseName: string) {
    return getAggregatedComponentMap(
      state,
      filepathOrBaseName,
      state.aggregatedComponentsMap,
      baseName => state.componentsMap.get(baseName),
    )
  }

  function getAggregatedAutoImportComponents(filepathOrBaseName: string) {
    return getAggregatedComponentMap(
      state,
      filepathOrBaseName,
      state.aggregatedAutoImportComponentsMap,
      baseName => state.autoImportComponentsMap.get(baseName) ?? state.componentsMap.get(baseName),
    )
  }

  function setWxmlComponentsMap(absPath: string, components: ComponentsMap) {
    const baseName = removeExtensionDeep(absPath)
    state.templatePathMap.set(baseName, absPath)
    if (Object.keys(components).length === 0) {
      state.componentsMap.delete(baseName)
    }
    else {
      state.componentsMap.set(baseName, components)
    }
    invalidateAggregatedComponents(state, absPath, state.aggregatedComponentsMap)
  }

  return {
    getAggregatedComponents,
    getAggregatedAutoImportComponents,
    setWxmlComponentsMap,
  }
}
