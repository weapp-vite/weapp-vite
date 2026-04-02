import type { AstEngineName } from '../../../../ast/types'
import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { ModuleResolver, WevuPageFeatureFlag } from '../types'
import { collectTargetOptionsObjectsFromCode, getSetupFunctionFromOptionsObject } from '../optionsObjects'
import { walkReachableWevuFeatures } from './walk'

export async function collectWevuFeaturesFromSetupReachableImports(
  pageModule: ModuleAnalysis,
  setupFn: FunctionLike,
  resolver: ModuleResolver,
  moduleCache: Map<string, ModuleAnalysis>,
  options?: {
    astEngine?: 'babel' | 'oxc'
  },
): Promise<Set<WevuPageFeatureFlag>> {
  return await walkReachableWevuFeatures({
    pageModule,
    setupFn,
    resolver,
    moduleCache,
    astEngine: options?.astEngine,
  })
}

export async function collectWevuFeaturesFromCodeReachableImports(
  code: string,
  options: {
    id: string
    resolver: ModuleResolver
    astEngine?: AstEngineName
  },
): Promise<Set<WevuPageFeatureFlag>> {
  const { optionsObjects, module } = collectTargetOptionsObjectsFromCode(code, options.id, {
    astEngine: options.astEngine,
  })

  if (!optionsObjects.length) {
    return new Set<WevuPageFeatureFlag>()
  }

  const moduleCache = new Map<string, ModuleAnalysis>([
    [options.id, module],
  ])
  const enabled = new Set<WevuPageFeatureFlag>()

  for (const optionsObject of optionsObjects) {
    const setupFn = getSetupFunctionFromOptionsObject(optionsObject)
    if (!setupFn) {
      continue
    }

    const reachable = await collectWevuFeaturesFromSetupReachableImports(
      module,
      setupFn,
      options.resolver,
      moduleCache,
      { astEngine: options.astEngine },
    )

    for (const feature of reachable) {
      enabled.add(feature)
    }
  }

  return enabled
}
