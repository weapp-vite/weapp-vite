import type { InlineExpressionAsset } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseBabelExpression } from './expression/parse'

/** 普通 SFC 与作用域插槽共用内联资源生成，helper 仅绑定在当前表达式闭包内。 */
export function buildInlineExpressionMap(
  inlineExpressions: InlineExpressionAsset[],
  unrefImport?: t.Identifier,
): t.ObjectExpression {
  return t.objectExpression(inlineExpressions.map((entry) => {
    const { parameterNames } = entry
    let fn: t.Expression = t.arrowFunctionExpression([
      t.identifier(parameterNames.context),
      t.identifier(parameterNames.scope),
      t.identifier(parameterNames.event),
    ], parseBabelExpression(entry.expression) ?? t.identifier('undefined'))
    if (entry.runtimeHelpers?.unref) {
      if (!unrefImport) {
        throw new Error('生成 maybe-ref 内联表达式需要 unref 运行时导入。')
      }
      fn = t.callExpression(
        t.arrowFunctionExpression([t.identifier(entry.runtimeHelpers.unref)], fn),
        [t.cloneNode(unrefImport)],
      )
    }
    const properties: t.ObjectProperty[] = [
      t.objectProperty(t.identifier('keys'), t.arrayExpression(entry.scopeKeys.map(key => t.stringLiteral(key)))),
      t.objectProperty(t.identifier('fn'), fn),
    ]
    if (entry.indexBindings?.length) {
      properties.push(t.objectProperty(
        t.identifier('indexKeys'),
        t.arrayExpression(entry.indexBindings.map(binding => t.stringLiteral(binding.key))),
      ))
    }
    if (entry.scopeResolvers?.length) {
      const resolvers = new Map(entry.scopeResolvers.map(item => [item.key, item.expression]))
      properties.push(t.objectProperty(
        t.identifier('scopeResolvers'),
        t.arrayExpression(entry.scopeKeys.map(key => parseBabelExpression(resolvers.get(key) ?? '') ?? t.identifier('undefined'))),
      ))
    }
    return t.objectProperty(t.stringLiteral(entry.id), t.objectExpression(properties))
  }))
}
