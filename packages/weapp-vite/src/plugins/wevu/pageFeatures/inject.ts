import type { ModuleAnalysis } from './analysis'
import type { ModuleResolver, WevuPageFeatureFlag } from './types'
import { generate, parseJsLike } from '../../../utils/babel'
import { collectTargetOptionsObjects, collectWevuFeaturesFromSetupReachableImports, getSetupFunctionFromOptionsObject } from './analysis'
import { collectWevuPageFeatureFlags, injectWevuPageFeatureFlagsIntoOptionsObject } from './flags'

export function injectWevuPageFeaturesInJs(
  source: string,
): { code: string, transformed: boolean } {
  const ast = parseJsLike(source)

  const enabled = collectWevuPageFeatureFlags(ast)
  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  const { optionsObjects } = collectTargetOptionsObjects(ast, '<inline>')
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const target of optionsObjects) {
    changed = injectWevuPageFeatureFlagsIntoOptionsObject(target, enabled) || changed
  }

  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}

export async function injectWevuPageFeaturesInJsWithResolver(
  source: string,
  options: { id: string, resolver: ModuleResolver },
): Promise<{ code: string, transformed: boolean }> {
  const ast = parseJsLike(source)
  const { optionsObjects, module } = collectTargetOptionsObjects(ast, options.id)
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  const enabled = new Set<WevuPageFeatureFlag>()
  for (const flag of collectWevuPageFeatureFlags(ast)) {
    enabled.add(flag)
  }

  const moduleCache = new Map<string, ModuleAnalysis>()
  moduleCache.set(options.id, module)

  for (const optionsObject of optionsObjects) {
    const setupFn = getSetupFunctionFromOptionsObject(optionsObject)
    if (!setupFn) {
      continue
    }
    const fromImports = await collectWevuFeaturesFromSetupReachableImports(module, setupFn, options.resolver, moduleCache)
    for (const flag of fromImports) {
      enabled.add(flag)
    }
  }

  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const optionsObject of optionsObjects) {
    changed = injectWevuPageFeatureFlagsIntoOptionsObject(optionsObject, enabled) || changed
  }
  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}
