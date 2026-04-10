import type { WxmlServiceState } from './shared'
import { toPosixPath } from '../../../utils'

export function createClearAll(
  state: WxmlServiceState,
  unlinkImporter: (dep: string, importer: string) => void,
) {
  return function clearAll(options?: { clearEmittedCode?: boolean }) {
    const clearEmittedCode = options?.clearEmittedCode !== false
    const currentRoot = state.ctx.configService?.currentSubPackageRoot
    if (!currentRoot) {
      state.depsMap.clear()
      state.importerMap.clear()
      state.tokenMap.clear()
      state.componentsMap.clear()
      state.aggregatedComponentsMap.clear()
      state.autoImportComponentsMap.clear()
      state.aggregatedAutoImportComponentsMap.clear()
      state.templatePathMap.clear()
      state.cache.cache.clear()
      state.cache.mtimeMap.clear()
      state.cache.signatureMap.clear()
      if (clearEmittedCode) {
        state.emittedCode.clear()
      }
      return
    }

    const shouldClear = (absPath: string) => {
      const relative = state.ctx.configService!.relativeAbsoluteSrcRoot(absPath)
      return relative.startsWith(`${currentRoot}/`)
    }

    for (const key of Array.from(state.depsMap.keys())) {
      if (shouldClear(key)) {
        const depSet = state.depsMap.get(key)
        if (depSet) {
          for (const dep of depSet) {
            unlinkImporter(dep, key)
          }
        }
        state.depsMap.delete(key)
        continue
      }

      const depSet = state.depsMap.get(key)
      if (depSet) {
        for (const dep of Array.from(depSet)) {
          if (shouldClear(dep)) {
            unlinkImporter(dep, key)
            depSet.delete(dep)
          }
        }
      }
    }

    for (const key of Array.from(state.importerMap.keys())) {
      if (shouldClear(key)) {
        state.importerMap.delete(key)
      }
    }
    for (const key of Array.from(state.tokenMap.keys())) {
      if (shouldClear(key)) {
        state.tokenMap.delete(key)
      }
    }
    for (const key of Array.from(state.componentsMap.keys())) {
      if (shouldClear(key)) {
        state.componentsMap.delete(key)
      }
    }
    for (const key of Array.from(state.aggregatedComponentsMap.keys())) {
      if (shouldClear(key)) {
        state.aggregatedComponentsMap.delete(key)
      }
    }
    for (const key of Array.from(state.autoImportComponentsMap.keys())) {
      if (shouldClear(key)) {
        state.autoImportComponentsMap.delete(key)
      }
    }
    for (const key of Array.from(state.aggregatedAutoImportComponentsMap.keys())) {
      if (shouldClear(key)) {
        state.aggregatedAutoImportComponentsMap.delete(key)
      }
    }
    for (const [key, value] of Array.from(state.templatePathMap.entries())) {
      if (shouldClear(key) || shouldClear(value)) {
        state.templatePathMap.delete(key)
      }
    }
    for (const key of Array.from(state.cache.cache.keys())) {
      if (shouldClear(key)) {
        state.cache.delete(key)
      }
    }
    for (const key of Array.from(state.cache.mtimeMap.keys())) {
      if (shouldClear(key)) {
        state.cache.mtimeMap.delete(key)
      }
    }
    if (clearEmittedCode) {
      for (const key of Array.from(state.emittedCode.keys())) {
        const normalized = toPosixPath(key)
        if (normalized === currentRoot || normalized.startsWith(`${currentRoot}/`)) {
          state.emittedCode.delete(key)
        }
      }
    }
  }
}
