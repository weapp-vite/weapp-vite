import type { File as BabelFile } from '@babel/types'
import type { WevuDefaults } from 'wevu'
import type { WevuPageFeatureFlag } from '../../../../wevu/pageFeatures'
import type { TransformScriptOptions, TransformState } from '../utils'
import * as t from '@babel/types'
import logger from '../../../../../logger'
import { injectWevuPageFeatureFlagsIntoOptionsObject } from '../../../../wevu/pageFeatures'
import { resolveComponentExpression } from '../../scriptComponent'
import { ensureClassStyleRuntimeImports, injectClassStyleComputed } from './classStyle'
import { applyWevuDefaultsToComponentOptions, injectWevuDefaultsForApp } from './defaults'
import { rewriteComponentExport } from './export'
import { injectTemplateRefs } from './templateRefs'

export function rewriteDefaultExport(
  ast: BabelFile,
  state: TransformState,
  options: TransformScriptOptions | undefined,
  enabledPageFeatures: Set<WevuPageFeatureFlag>,
  serializedWevuDefaults: string | undefined,
  parsedWevuDefaults: WevuDefaults | undefined,
): boolean {
  if (!state.defaultExportPath) {
    return false
  }

  let transformed = false
  const exportPath = state.defaultExportPath
  const componentExpr = resolveComponentExpression(
    exportPath.node.declaration,
    state.defineComponentDecls,
    state.defineComponentAliases,
  )

  if (componentExpr && t.isObjectExpression(componentExpr) && enabledPageFeatures.size) {
    transformed = injectWevuPageFeatureFlagsIntoOptionsObject(componentExpr, enabledPageFeatures) || transformed
  }

  if (componentExpr && t.isObjectExpression(componentExpr) && parsedWevuDefaults) {
    transformed = applyWevuDefaultsToComponentOptions({
      componentExpr,
      parsedWevuDefaults,
      options,
    }) || transformed
  }

  const classStyleBindings = options?.classStyleRuntime === 'js'
    ? (options?.classStyleBindings ?? [])
    : []
  if (classStyleBindings.length) {
    if (componentExpr && t.isObjectExpression(componentExpr)) {
      ensureClassStyleRuntimeImports(ast.program)
      transformed = injectClassStyleComputed(componentExpr, classStyleBindings) || transformed
    }
    else {
      logger.warn('无法自动注入 class/style 计算属性：组件选项不是对象字面量。')
    }
  }

  const templateRefs = options?.templateRefs ?? []
  if (templateRefs.length) {
    if (componentExpr && t.isObjectExpression(componentExpr)) {
      transformed = injectTemplateRefs(componentExpr, templateRefs) || transformed
    }
    else {
      logger.warn('无法自动注入 template ref 元数据：组件选项不是对象字面量。')
    }
  }

  if (componentExpr) {
    if (options?.isApp) {
      transformed = injectWevuDefaultsForApp({
        astProgram: ast.program,
        options,
        serializedWevuDefaults,
      }) || transformed
    }
    transformed = rewriteComponentExport({
      ast,
      exportPath,
      componentExpr,
      isAppFile: !!options?.isApp,
      skipComponentTransform: options?.skipComponentTransform,
    }) || transformed
  }

  return transformed
}

export { serializeWevuDefaults } from './defaults'
