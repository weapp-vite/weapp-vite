import type { File as BabelFile } from '@babel/types'
import type { WevuDefaults } from '../../../../../types/wevu'
import type { WevuPageFeatureFlag } from '../../../../wevu/pageFeatures'
import type { TransformScriptOptions, TransformState } from '../utils'
import { resolveWarnHandler } from '../../../../../utils/warn'
import { injectWevuPageFeatureFlagsIntoOptionsObject } from '../../../../wevu/pageFeatures'
import { resolveComponentExpression, resolveComponentOptionsObject } from '../../scriptComponent'
import { ensureClassStyleRuntimeImports, injectClassStyleComputed } from './classStyle'
import { applyWevuDefaultsToComponentOptions, injectWevuDefaultsForApp } from './defaults'
import { rewriteComponentExport } from './export'
import { injectInlineExpressions } from './inlineExpressions'
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

  const warn = resolveWarnHandler(options?.warn)
  let transformed = false
  const exportPath = state.defaultExportPath
  const componentExpr = resolveComponentExpression(
    exportPath.node.declaration,
    state.defineComponentDecls,
    state.defineComponentAliases,
  )
  const componentOptionsObject = resolveComponentOptionsObject(componentExpr)

  if (componentOptionsObject && enabledPageFeatures.size) {
    transformed = injectWevuPageFeatureFlagsIntoOptionsObject(componentOptionsObject, enabledPageFeatures) || transformed
  }

  if (componentOptionsObject && parsedWevuDefaults) {
    transformed = applyWevuDefaultsToComponentOptions({
      componentExpr: componentOptionsObject,
      parsedWevuDefaults,
      options,
    }) || transformed
  }

  const classStyleBindings = options?.classStyleBindings ?? []
  if (classStyleBindings.length) {
    if (componentOptionsObject) {
      ensureClassStyleRuntimeImports(ast.program)
      transformed = injectClassStyleComputed(componentOptionsObject, classStyleBindings, warn) || transformed
    }
    else {
      warn('无法自动注入 class/style 计算属性：组件选项不是对象字面量。')
    }
  }

  const templateRefs = options?.templateRefs ?? []
  if (templateRefs.length) {
    if (componentOptionsObject) {
      transformed = injectTemplateRefs(componentOptionsObject, templateRefs, warn) || transformed
    }
    else {
      warn('无法自动注入 template ref 元数据：组件选项不是对象字面量。')
    }
  }

  const inlineExpressions = options?.inlineExpressions ?? []
  if (inlineExpressions.length) {
    if (componentOptionsObject) {
      const injected = injectInlineExpressions(componentOptionsObject, inlineExpressions)
      if (!injected) {
        warn('无法自动注入内联表达式元数据：methods 不是对象字面量。')
      }
      transformed = injected || transformed
    }
    else {
      warn('无法自动注入内联表达式元数据：组件选项不是对象字面量。')
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
