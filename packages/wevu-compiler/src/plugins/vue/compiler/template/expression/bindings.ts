import type { TransformContext } from '../types'
import * as t from '@babel/types'
import { generateExpression, parseBabelExpression } from './parse'
import { normalizeWxmlExpressionWithContext } from './scopedSlot'

export function normalizeClassBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpressionWithContext(generateExpression(node), context))
  }

  const visit = (node: t.Expression | null | undefined) => {
    if (!node) {
      return
    }
    if (t.isArrayExpression(node)) {
      for (const el of node.elements) {
        if (!el) {
          continue
        }
        if (t.isSpreadElement(el)) {
          context.warnings.push('小程序不支持 :class 的展开语法，已忽略。')
          continue
        }
        if (t.isExpression(el)) {
          visit(el)
        }
      }
      return
    }
    if (t.isObjectExpression(node)) {
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          context.warnings.push('小程序不支持 :class 对象的展开语法，已忽略。')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const value = prop.value
        if (!t.isExpression(value)) {
          continue
        }
        const test = value
        if (prop.computed) {
          const keyExpr = prop.key
          if (!t.isExpression(keyExpr)) {
            continue
          }
          pushExpr(t.conditionalExpression(test, keyExpr, t.stringLiteral('')))
        }
        else if (t.isIdentifier(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.name), t.stringLiteral('')))
        }
        else if (t.isStringLiteral(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.value), t.stringLiteral('')))
        }
      }
      return
    }

    pushExpr(node)
  }

  visit(ast)

  if (!out.length) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }
  return out
}

export function normalizeStyleBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpressionWithContext(generateExpression(node), context))
  }

  const buildKeyExpression = (
    key: t.Expression | t.Identifier | t.StringLiteral | t.NumericLiteral | t.BooleanLiteral,
    computed: boolean,
  ) => {
    if (computed) {
      return t.isExpression(key) ? key : null
    }
    if (t.isIdentifier(key)) {
      return t.stringLiteral(key.name)
    }
    if (t.isStringLiteral(key)) {
      return t.stringLiteral(key.value)
    }
    if (t.isNumericLiteral(key)) {
      return t.stringLiteral(String(key.value))
    }
    if (t.isBooleanLiteral(key)) {
      return t.stringLiteral(String(key.value))
    }
    return null
  }

  const buildStylePair = (keyExpr: t.Expression, valueExpr: t.Expression) => {
    return t.callExpression(
      t.memberExpression(t.identifier('__weapp_vite'), t.identifier('stylePair')),
      [keyExpr, valueExpr],
    )
  }

  const visit = (node: t.Expression | null | undefined) => {
    if (!node) {
      return
    }
    if (t.isArrayExpression(node)) {
      for (const el of node.elements) {
        if (!el) {
          continue
        }
        if (t.isSpreadElement(el)) {
          context.warnings.push('小程序不支持 :style 的展开语法，已忽略。')
          continue
        }
        if (t.isExpression(el)) {
          visit(el)
        }
      }
      return
    }
    if (t.isObjectExpression(node)) {
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          context.warnings.push('小程序不支持 :style 对象的展开语法，已忽略。')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const value = prop.value
        if (!t.isExpression(value)) {
          continue
        }
        const keyExpr = buildKeyExpression(prop.key as any, prop.computed)
        if (!keyExpr) {
          continue
        }
        pushExpr(buildStylePair(keyExpr, value))
      }
      return
    }

    pushExpr(node)
  }

  visit(ast)

  if (!out.length) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }
  return out
}
