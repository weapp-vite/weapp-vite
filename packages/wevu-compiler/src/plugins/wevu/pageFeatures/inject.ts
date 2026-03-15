import type { AstEngineName } from '../../../ast/types'
import type { ModuleAnalysis } from './analysis'
import type { ModuleResolver, WevuPageFeatureFlag } from './types'
import { collectWevuPageFeatureFlagsFromCode } from '../../../ast/operations/pageFeatures'
import { generate, parseJsLike } from '../../../utils/babel'
import { collectTargetOptionsObjects, collectWevuFeaturesFromSetupReachableImports, getSetupFunctionFromOptionsObject } from './analysis'
import { injectWevuPageFeatureFlagsIntoOptionsObject } from './flags'

/**
 * 在 JS 源码中注入 wevu 页面特性（基于本文件分析）。
 */
export function injectWevuPageFeaturesInJs(
  source: string,
  options?: {
    astEngine?: AstEngineName
  },
): { code: string, transformed: boolean } {
  const enabled = collectWevuPageFeatureFlagsFromCode(source, options)
  if (!enabled.size) {
    return { code: source, transformed: false }
  }

  const ast = parseJsLike(source)
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

/**
 * 在 JS 源码中注入 wevu 页面特性（支持跨模块解析）。
 */
export async function injectWevuPageFeaturesInJsWithResolver(
  source: string,
  options: { id: string, resolver: ModuleResolver, astEngine?: AstEngineName },
): Promise<{ code: string, transformed: boolean }> {
  const ast = parseJsLike(source)
  const { optionsObjects, module } = collectTargetOptionsObjects(ast, options.id)
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  const enabled = new Set<WevuPageFeatureFlag>()
  for (const flag of collectWevuPageFeatureFlagsFromCode(source, options)) {
    enabled.add(flag)
  }

  const moduleCache = new Map<string, ModuleAnalysis>()
  moduleCache.set(options.id, module)

  for (const optionsObject of optionsObjects) {
    const setupFn = getSetupFunctionFromOptionsObject(optionsObject)
    if (!setupFn) {
      continue
    }
    const fromImports = await collectWevuFeaturesFromSetupReachableImports(module, setupFn, options.resolver, moduleCache, {
      astEngine: options.astEngine,
    })
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
