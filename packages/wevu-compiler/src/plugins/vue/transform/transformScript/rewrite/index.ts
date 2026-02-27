import type { File as BabelFile, ObjectExpression, Program } from '@babel/types'
import type { WevuDefaults } from '../../../../../types/wevu'
import type { WevuPageFeatureFlag } from '../../../../wevu/pageFeatures'
import type { TransformScriptOptions, TransformState } from '../utils'
import * as t from '@babel/types'
import { resolveWarnHandler } from '../../../../../utils/warn'
import { injectWevuPageFeatureFlagsIntoOptionsObject } from '../../../../wevu/pageFeatures'
import { resolveComponentExpression, resolveComponentOptionsObject } from '../../scriptComponent'
import { ensureClassStyleRuntimeImports, injectClassStyleComputed } from './classStyle'
import { applyWevuDefaultsToComponentOptions, injectWevuDefaultsForApp } from './defaults'
import { rewriteComponentExport } from './export'
import { injectInlineExpressions } from './inlineExpressions'
import { injectTemplateRefs } from './templateRefs'

function hasStaticProperty(target: ObjectExpression, keyName: string) {
  for (const prop of target.properties) {
    if ((prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') || prop.computed) {
      continue
    }
    const key = prop.key
    if (key.type === 'Identifier' && key.name === keyName) {
      return true
    }
    if (key.type === 'StringLiteral' && key.value === keyName) {
      return true
    }
  }
  return false
}

function isObjectAssignCall(node: t.CallExpression) {
  const callee = node.callee
  return t.isMemberExpression(callee)
    && t.isIdentifier(callee.object, { name: 'Object' })
    && t.isIdentifier(callee.property, { name: 'assign' })
}

function unwrapTypeLikeExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node) || t.isTypeCastExpression(node)) {
    return unwrapTypeLikeExpression(node.expression as t.Expression)
  }
  if (t.isParenthesizedExpression(node)) {
    return unwrapTypeLikeExpression(node.expression)
  }
  return node
}

function resolveObjectExpressionFromProgram(program: Program, name: string): ObjectExpression | null {
  for (let index = program.body.length - 1; index >= 0; index -= 1) {
    const statement = program.body[index]
    if (!t.isVariableDeclaration(statement)) {
      continue
    }
    for (const declarator of statement.declarations) {
      if (!t.isIdentifier(declarator.id, { name }) || !declarator.init || !t.isExpression(declarator.init)) {
        continue
      }
      const normalized = unwrapTypeLikeExpression(declarator.init)
      if (t.isObjectExpression(normalized)) {
        return normalized
      }
      if (t.isCallExpression(normalized) && isObjectAssignCall(normalized)) {
        const lastArg = normalized.arguments[normalized.arguments.length - 1]
        if (lastArg && !t.isSpreadElement(lastArg) && t.isExpression(lastArg)) {
          const lastNormalized = unwrapTypeLikeExpression(lastArg)
          if (t.isObjectExpression(lastNormalized)) {
            return lastNormalized
          }
        }
      }
    }
  }
  return null
}

function hasStaticPropertyWithSpreads(
  target: ObjectExpression,
  keyName: string,
  program: Program,
  visited: Set<string> = new Set(),
) {
  if (hasStaticProperty(target, keyName)) {
    return true
  }

  for (const prop of target.properties) {
    if (!t.isSpreadElement(prop)) {
      continue
    }
    const spreadArg = prop.argument
    if (t.isObjectExpression(spreadArg) && hasStaticPropertyWithSpreads(spreadArg, keyName, program, visited)) {
      return true
    }
    if (!t.isIdentifier(spreadArg) || visited.has(spreadArg.name)) {
      continue
    }
    visited.add(spreadArg.name)
    const resolved = resolveObjectExpressionFromProgram(program, spreadArg.name)
    if (resolved && hasStaticPropertyWithSpreads(resolved, keyName, program, visited)) {
      return true
    }
  }

  return false
}

function hasStaticPropertyInComponentExpression(
  componentExpr: t.Expression,
  keyName: string,
  program: Program,
) {
  const normalized = unwrapTypeLikeExpression(componentExpr)
  if (t.isObjectExpression(normalized)) {
    return hasStaticPropertyWithSpreads(normalized, keyName, program)
  }
  if (!t.isCallExpression(normalized) || !isObjectAssignCall(normalized)) {
    return false
  }
  for (const arg of normalized.arguments) {
    if (t.isSpreadElement(arg) || !t.isExpression(arg)) {
      continue
    }
    const expr = unwrapTypeLikeExpression(arg)
    if (t.isObjectExpression(expr) && hasStaticPropertyWithSpreads(expr, keyName, program)) {
      return true
    }
    if (t.isIdentifier(expr)) {
      const resolved = resolveObjectExpressionFromProgram(program, expr.name)
      if (resolved && hasStaticPropertyWithSpreads(resolved, keyName, program, new Set([expr.name]))) {
        return true
      }
    }
  }
  return false
}

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

  const hasPageMarker = componentExpr
    ? hasStaticPropertyInComponentExpression(componentExpr, '__wevu_isPage', ast.program)
    : false

  if (componentOptionsObject && options?.isPage && !options?.isApp && !hasPageMarker) {
    componentOptionsObject.properties.splice(
      0,
      0,
      t.objectProperty(t.identifier('__wevu_isPage'), t.booleanLiteral(true)),
    )
    transformed = true
  }

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
