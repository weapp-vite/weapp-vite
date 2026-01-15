import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { ModuleResolver } from '../types'
import { WE_VU_MODULE_ID } from 'wevu/compiler'
import { getOrCreateExternalModuleAnalysis } from '../moduleAnalysis'

function resolveExportedFunctionNode(
  module: ModuleAnalysis,
  exportName: string,
): { type: 'reexport', source: string, importedName: string } | { type: 'inline', node: FunctionLike } | null {
  const target = module.exports.get(exportName)
  if (!target) {
    return null
  }
  if (target.type === 'local') {
    const fn = module.localFunctions.get(target.localName)
    return fn ? { type: 'inline', node: fn } : null
  }
  if (target.type === 'reexport') {
    return target
  }
  if (target.type === 'inline') {
    return target
  }
  return null
}

export type ResolvedFunctionRef
  = | { moduleId: string, fn: FunctionLike, module: ModuleAnalysis }
    | { moduleId: string, reexport: { source: string, importedName: string } }
    | null

export async function resolveExternalFunction(
  resolver: ModuleResolver,
  importerId: string,
  source: string,
  exportName: string,
  moduleCache: Map<string, ModuleAnalysis>,
): Promise<ResolvedFunctionRef> {
  if (source === WE_VU_MODULE_ID) {
    return null
  }

  const resolvedId = await resolver.resolveId(source, importerId)
  if (!resolvedId) {
    return null
  }

  const code = await resolver.loadCode(resolvedId)
  if (!code) {
    return null
  }

  let analysis = moduleCache.get(resolvedId)
  if (!analysis) {
    analysis = getOrCreateExternalModuleAnalysis(resolvedId, code)
    moduleCache.set(resolvedId, analysis)
  }

  const target = resolveExportedFunctionNode(analysis, exportName)
  if (!target) {
    return null
  }

  if (target.type === 'reexport') {
    return { moduleId: resolvedId, reexport: { source: target.source, importedName: target.importedName } }
  }

  if (target.type === 'inline') {
    return { moduleId: resolvedId, fn: target.node, module: analysis }
  }

  return null
}
