import type { ScanWxmlResult } from '../../../wxml'
import type { WxmlServiceState } from './shared'
import path from 'pathe'
import { isTemplate } from '../../../utils'
import { isScriptModuleTagName } from '../../../utils/wxmlScriptModule'
import { isTemplateImportTag } from '../../../wxml'
import { requireConfigService } from '../../utils/requireConfigService'
import { invalidateAggregatedComponents, linkImporter, unlinkImporter } from './shared'

export interface WxmlDependencyService {
  addDeps: (filepath: string, deps?: string[]) => Promise<void>
  setDeps: (filepath: string, deps?: string[]) => Promise<void>
  collectDepsFromToken: (filepath: string, deps?: ScanWxmlResult['deps']) => string[]
  getImporters: (filepath: string) => Set<string>
  getAllDeps: () => Set<string>
  unlinkImporter: (dep: string, importer: string) => void
}

export function createWxmlDependencyService(
  state: WxmlServiceState,
  scanTemplateDep: (filepath: string) => Promise<unknown>,
): WxmlDependencyService {
  async function setDeps(filepath: string, deps: string[] = []) {
    const nextDeps = new Set<string>(deps)
    const previousDeps = state.depsMap.get(filepath) ?? new Set<string>()
    const nextDepsKey = Array.from(nextDeps).sort().join('\0')
    const previousDepsKey = Array.from(previousDeps).sort().join('\0')

    for (const previousDep of previousDeps) {
      if (!nextDeps.has(previousDep)) {
        unlinkImporter(state, previousDep, filepath)
      }
    }

    for (const dep of nextDeps) {
      linkImporter(state, dep, filepath)
    }

    state.depsMap.set(filepath, nextDeps)
    if (nextDepsKey !== previousDepsKey) {
      invalidateAggregatedComponents(state, filepath, state.aggregatedComponentsMap)
      invalidateAggregatedComponents(state, filepath, state.aggregatedAutoImportComponentsMap)
    }
    await Promise.all(
      Array.from(nextDeps)
        .filter(dep => isTemplate(dep))
        .map(async (dep) => {
          return await scanTemplateDep(dep)
        }),
    )
  }

  async function addDeps(filepath: string, deps: string[] = []) {
    const currentDeps = state.depsMap.get(filepath) ?? new Set<string>()
    await setDeps(filepath, [...currentDeps, ...deps])
  }

  function resolveDepPath(filepath: string, value: string) {
    const configService = requireConfigService(state.ctx, '解析 WXML 依赖前必须初始化 configService。')
    const dirname = path.dirname(filepath)
    if (value.startsWith('/')) {
      return path.resolve(configService.absoluteSrcRoot, value.slice(1))
    }
    return path.resolve(dirname, value)
  }

  function collectDepsFromToken(filepath: string, deps: ScanWxmlResult['deps'] = []) {
    return deps.reduce<string[]>((resolvedDeps, dep) => {
      if (!dep.value) {
        return resolvedDeps
      }
      if (isTemplateImportTag(dep.tagName) && !isTemplate(dep.value)) {
        return resolvedDeps
      }
      if (!isTemplateImportTag(dep.tagName) && !isScriptModuleTagName(dep.tagName)) {
        return resolvedDeps
      }
      resolvedDeps.push(resolveDepPath(filepath, dep.value))
      return resolvedDeps
    }, [])
  }

  function getImporters(filepath: string) {
    return new Set<string>(state.importerMap.get(filepath) ?? [])
  }

  function getAllDeps() {
    const set = new Set<string>()
    for (const [key, value] of state.depsMap) {
      set.add(key)
      for (const item of value) {
        set.add(item)
      }
    }
    return set
  }

  return {
    addDeps,
    setDeps,
    collectDepsFromToken,
    getImporters,
    getAllDeps,
    unlinkImporter(dep: string, importer: string) {
      unlinkImporter(state, dep, importer)
    },
  }
}
