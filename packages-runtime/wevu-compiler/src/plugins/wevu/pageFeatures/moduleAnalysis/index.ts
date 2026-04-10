import type { AstEngineName } from '../../../../ast/types'
import type { ModuleAnalysis } from './types'
import { parseJsLike } from '../../../../utils/babel'
import { createModuleAnalysis } from './babel'
import { createModuleAnalysisWithOxc } from './oxc'
import { createEmptyModuleAnalysis, createExternalModuleAnalysisCacheKey, createModuleAnalysisCacheKey, externalModuleAnalysisCache, moduleAnalysisCache } from './shared'

export { createModuleAnalysis } from './babel'
export { createEmptyModuleAnalysis } from './shared'
export type { ExportTarget, FunctionLike, ImportBinding, ModuleAnalysis } from './types'

export function createModuleAnalysisFromCode(
  id: string,
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
) {
  const engine = options?.astEngine ?? 'babel'
  const cacheKey = createModuleAnalysisCacheKey(id, engine)
  const cached = moduleAnalysisCache.get(cacheKey)
  if (cached && cached.code === code) {
    return cached.analysis
  }

  let analysis: ModuleAnalysis
  if (engine === 'oxc') {
    if (!code.includes('import') && !code.includes('export')) {
      analysis = createEmptyModuleAnalysis(id, 'oxc')
    }
    else {
      analysis = createModuleAnalysisWithOxc(id, code)
    }
  }
  else {
    const ast = parseJsLike(code)
    analysis = createModuleAnalysis(id, ast)
  }

  moduleAnalysisCache.set(cacheKey, { code, analysis })
  return analysis
}

export function getOrCreateExternalModuleAnalysis(
  moduleId: string,
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
) {
  const cacheKey = createExternalModuleAnalysisCacheKey(moduleId, options?.astEngine)
  const cached = externalModuleAnalysisCache.get(cacheKey)
  if (cached && cached.code === code) {
    return cached.analysis
  }
  const analysis = createModuleAnalysisFromCode(moduleId, code, options)
  externalModuleAnalysisCache.set(cacheKey, { code, analysis })
  return analysis
}
