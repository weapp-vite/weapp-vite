import type { AstEngineName } from '../../../ast/types'
import type { EncodedSourceMapLike } from '../../../utils/sourcemap'
import type { ModuleAnalysis } from './analysis'
import type { ModuleResolver, WevuPageFeatureFlag } from './types'
import { collectWevuPageFeatureFlagsFromCode } from '../../../ast/operations/pageFeatures'
import { generate, parseJsLike } from '../../../utils/babel'
import { collectTargetOptionsObjects, collectTargetOptionsObjectsFromCode, collectWevuFeaturesFromSetupReachableImports, getSetupFunctionFromOptionsObject } from './analysis'
import { injectWevuPageFeatureFlagsIntoOptionsObject } from './flags'

/**
 * 在 JS 源码中注入 wevu 页面特性（基于本文件分析）。
 */
export function injectWevuPageFeaturesInJs(
  source: string,
  options?: {
    astEngine?: AstEngineName
    minify?: boolean
    sourceMap?: boolean
  },
): { code: string, transformed: boolean, map?: EncodedSourceMapLike | null } {
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

  const sourceMap = options?.sourceMap !== false
  const generated = generate(ast, {
    compact: options?.minify === true,
    minified: options?.minify === true,
    retainLines: options?.minify !== true,
    sourceMaps: sourceMap,
    sourceFileName: 'inline.js',
  }, source)
  return { code: generated.code, transformed: true, map: sourceMap ? generated.map as EncodedSourceMapLike : null }
}

/**
 * 在 JS 源码中注入 wevu 页面特性（支持跨模块解析）。
 */
export async function injectWevuPageFeaturesInJsWithResolver(
  source: string,
  options: { id: string, resolver: ModuleResolver, astEngine?: AstEngineName, minify?: boolean, sourceMap?: boolean },
): Promise<{ code: string, transformed: boolean, map?: EncodedSourceMapLike | null }> {
  const preflight = collectTargetOptionsObjectsFromCode(source, options.id, {
    astEngine: options.astEngine,
  })
  if (!preflight.optionsObjects.length) {
    return { code: source, transformed: false }
  }

  const ast = parseJsLike(source)
  const { optionsObjects } = collectTargetOptionsObjects(ast, options.id)
  if (!optionsObjects.length) {
    return { code: source, transformed: false }
  }

  const enabled = new Set<WevuPageFeatureFlag>()
  for (const flag of collectWevuPageFeatureFlagsFromCode(source, options)) {
    enabled.add(flag)
  }

  const moduleCache = new Map<string, ModuleAnalysis>()
  moduleCache.set(options.id, preflight.module)

  for (const optionsObject of optionsObjects) {
    const setupFn = getSetupFunctionFromOptionsObject(optionsObject)
    if (!setupFn) {
      continue
    }
    const fromImports = await collectWevuFeaturesFromSetupReachableImports(preflight.module, setupFn, options.resolver, moduleCache, {
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

  const sourceMap = options?.sourceMap !== false
  const generated = generate(ast, {
    compact: options?.minify === true,
    minified: options?.minify === true,
    retainLines: options?.minify !== true,
    sourceMaps: sourceMap,
    sourceFileName: 'inline.js',
  }, source)
  return { code: generated.code, transformed: true, map: sourceMap ? generated.map as EncodedSourceMapLike : null }
}
