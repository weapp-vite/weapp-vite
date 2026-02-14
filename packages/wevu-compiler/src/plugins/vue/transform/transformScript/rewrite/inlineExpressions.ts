import type { InlineExpressionAsset } from '../../../compiler/template/types'
import * as t from '@babel/types'
import { parseBabelExpression } from '../../../compiler/template/expression/parse'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

function buildInlineMapExpression(inlineExpressions: InlineExpressionAsset[]): t.ObjectExpression {
  const entries = inlineExpressions.map((entry) => {
    const keysExpr = t.arrayExpression(entry.scopeKeys.map(key => t.stringLiteral(key)))
    const exprAst = parseBabelExpression(entry.expression) ?? t.identifier('undefined')
    const fnExpr = t.arrowFunctionExpression(
      [t.identifier('ctx'), t.identifier('scope'), t.identifier('$event')],
      exprAst,
    )
    const entryObjProps: t.ObjectProperty[] = [
      t.objectProperty(t.identifier('keys'), keysExpr),
      t.objectProperty(t.identifier('fn'), fnExpr),
    ]

    if (entry.indexBindings?.length) {
      const indexKeysExpr = t.arrayExpression(entry.indexBindings.map(binding => t.stringLiteral(binding.key)))
      entryObjProps.push(
        t.objectProperty(t.identifier('indexKeys'), indexKeysExpr),
      )
    }

    if (entry.scopeResolvers?.length) {
      const resolverMap = new Map(entry.scopeResolvers.map(item => [item.key, item.expression]))
      const resolverExpr = t.arrayExpression(entry.scopeKeys.map((key) => {
        const source = resolverMap.get(key)
        if (!source) {
          return t.identifier('undefined')
        }
        return parseBabelExpression(source) ?? t.identifier('undefined')
      }))
      entryObjProps.push(
        t.objectProperty(t.identifier('scopeResolvers'), resolverExpr),
      )
    }

    const entryObj = t.objectExpression(entryObjProps)
    return t.objectProperty(t.stringLiteral(entry.id), entryObj)
  })
  return t.objectExpression(entries)
}

export function injectInlineExpressions(
  componentExpr: t.ObjectExpression,
  inlineExpressions: InlineExpressionAsset[],
): boolean {
  if (!inlineExpressions.length) {
    return false
  }
  const inlineMapExpr = buildInlineMapExpression(inlineExpressions)
  const methodsProp = getObjectPropertyByKey(componentExpr, 'methods')
  if (!methodsProp) {
    componentExpr.properties.push(
      t.objectProperty(
        createStaticObjectKey('methods'),
        t.objectExpression([
          t.objectProperty(createStaticObjectKey('__weapp_vite_inline_map'), inlineMapExpr),
        ]),
      ),
    )
    return true
  }
  if (!t.isObjectExpression(methodsProp.value)) {
    return false
  }
  const mapProp = getObjectPropertyByKey(methodsProp.value, '__weapp_vite_inline_map')
  if (!mapProp) {
    methodsProp.value.properties.push(
      t.objectProperty(createStaticObjectKey('__weapp_vite_inline_map'), inlineMapExpr),
    )
    return true
  }
  if (t.isObjectExpression(mapProp.value)) {
    mapProp.value.properties.push(...inlineMapExpr.properties)
    return true
  }
  return false
}
