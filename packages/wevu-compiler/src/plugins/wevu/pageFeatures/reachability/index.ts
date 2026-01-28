import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { ModuleResolver, WevuPageFeatureFlag } from '../types'
import { walkReachableWevuFeatures } from './walk'

export async function collectWevuFeaturesFromSetupReachableImports(
  pageModule: ModuleAnalysis,
  setupFn: FunctionLike,
  resolver: ModuleResolver,
  moduleCache: Map<string, ModuleAnalysis>,
): Promise<Set<WevuPageFeatureFlag>> {
  return await walkReachableWevuFeatures({
    pageModule,
    setupFn,
    resolver,
    moduleCache,
  })
}
