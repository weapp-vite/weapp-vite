import type { ScanWxmlResult } from '../../../wxml'
import type { WxmlDependencyKind, WxmlImporterDependencyKind, WxmlServiceState } from './shared'
import path from 'pathe'
import { isTemplate } from '../../../utils'
import { isScriptModuleTagName } from '../../../utils/wxmlScriptModule'
import { isTemplateImportTag } from '../../../wxml'
import { requireConfigService } from '../../utils/requireConfigService'
import { getImporterDependencyKind, invalidateAggregatedComponents, linkImporter, unlinkImporter } from './shared'

interface ResolvedWxmlDependency {
  path: string
  kind: WxmlDependencyKind
}

export interface WxmlDependencyService {
  addDeps: (filepath: string, deps?: string[]) => Promise<void>
  setDeps: (filepath: string, deps?: string[]) => Promise<void>
  setTokenDeps: (filepath: string, deps?: ScanWxmlResult['deps']) => Promise<void>
  collectDepsFromToken: (filepath: string, deps?: ScanWxmlResult['deps']) => string[]
  getImporters: (filepath: string) => Set<string>
  getImporterDependencyKind: (dep: string, importer: string) => WxmlImporterDependencyKind | undefined
  getAllDeps: () => Set<string>
  unlinkImporter: (dep: string, importer: string) => void
}

export function createWxmlDependencyService(
  state: WxmlServiceState,
  scanTemplateDep: (filepath: string) => Promise<unknown>,
): WxmlDependencyService {
  async function setDepRecords(filepath: string, deps: ResolvedWxmlDependency[] = []) {
    const nextDeps = new Set<string>(deps.map(dep => dep.path))
    const previousDeps = state.depsMap.get(filepath) ?? new Set<string>()
    const nextDepsKey = Array.from(nextDeps).sort().join('\0')
    const previousDepsKey = Array.from(previousDeps).sort().join('\0')

    for (const previousDep of previousDeps) {
      unlinkImporter(state, previousDep, filepath)
    }

    for (const dep of deps) {
      linkImporter(state, dep.path, filepath, dep.kind)
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

  async function setDeps(filepath: string, deps: string[] = []) {
    await setDepRecords(filepath, deps.map(dep => ({ path: dep, kind: 'unknown' as const })))
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

  function collectDepRecordsFromToken(filepath: string, deps: ScanWxmlResult['deps'] = []) {
    return deps.reduce<ResolvedWxmlDependency[]>((resolvedDeps, dep) => {
      if (!dep.value) {
        return resolvedDeps
      }
      if (isTemplateImportTag(dep.tagName) && !isTemplate(dep.value)) {
        return resolvedDeps
      }
      if (!isTemplateImportTag(dep.tagName) && !isScriptModuleTagName(dep.tagName)) {
        return resolvedDeps
      }
      const kind: WxmlDependencyKind = dep.tagName === 'import'
        ? 'template-import'
        : dep.tagName === 'include'
          ? 'template-include'
          : 'script-module'
      resolvedDeps.push({
        path: resolveDepPath(filepath, dep.value),
        kind,
      })
      return resolvedDeps
    }, [])
  }

  function collectDepsFromToken(filepath: string, deps: ScanWxmlResult['deps'] = []) {
    return collectDepRecordsFromToken(filepath, deps).map(dep => dep.path)
  }

  async function setTokenDeps(filepath: string, deps: ScanWxmlResult['deps'] = []) {
    await setDepRecords(filepath, collectDepRecordsFromToken(filepath, deps))
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
    setTokenDeps,
    collectDepsFromToken,
    getImporters,
    getImporterDependencyKind(dep: string, importer: string) {
      return getImporterDependencyKind(state, dep, importer)
    },
    getAllDeps,
    unlinkImporter(dep: string, importer: string) {
      unlinkImporter(state, dep, importer)
    },
  }
}
