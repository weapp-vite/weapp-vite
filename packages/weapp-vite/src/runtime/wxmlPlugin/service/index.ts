import type { MutableCompilerContext } from '../../../context'
import type { ScanWxmlResult } from '../../../wxml'
import type { WxmlService } from '../types'
import { createClearAll } from './clear'
import { createWxmlComponentService } from './components'
import { createWxmlDependencyService } from './deps'
import { createWxmlScanner } from './scan'
import { createWxmlServiceState } from './shared'

export function createWxmlService(ctx: MutableCompilerContext): WxmlService {
  const state = createWxmlServiceState(ctx)
  let scan: (filepath: string) => Promise<ScanWxmlResult | undefined> = async () => undefined
  const deps = createWxmlDependencyService(state, async (filepath) => {
    return await scan(filepath)
  })
  const components = createWxmlComponentService(state)
  const scanner = createWxmlScanner(state, {
    collectDepsFromToken: deps.collectDepsFromToken,
    setDeps: deps.setDeps,
  })
  scan = scanner.scan

  return {
    depsMap: state.depsMap,
    importerMap: state.importerMap,
    tokenMap: state.tokenMap,
    wxmlComponentsMap: state.componentsMap,
    aggregatedComponentsMap: state.aggregatedComponentsMap,
    addDeps: deps.addDeps,
    setDeps: deps.setDeps,
    collectDepsFromToken: deps.collectDepsFromToken,
    getImporters: deps.getImporters,
    getAllDeps: deps.getAllDeps,
    getAggregatedComponents: components.getAggregatedComponents,
    getAggregatedAutoImportComponents: components.getAggregatedAutoImportComponents,
    clearAll: createClearAll(state, deps.unlinkImporter),
    analyze: scanner.analyze,
    scan,
    setWxmlComponentsMap: components.setWxmlComponentsMap,
  }
}
