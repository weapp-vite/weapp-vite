import type { TransformContext } from './types'
import * as t from '@babel/types'
import { LRUCache } from 'lru-cache'
import { parse as babelParse, generate, traverse } from '../../../../utils/babel'

// 说明：`lru-cache@11` 的值类型要求非空（`V extends {}`），这里用 `false` 作为“缓存未命中”的哨兵值。
const babelExpressionCache = new LRUCache<string, t.Expression | false>({ max: 1024 })
const inlineHandlerCache = new LRUCache<string, { name: string, args: any[] } | false>({ max: 1024 })

const BABEL_GENERATE_MINI_PROGRAM_OPTIONS = {
  compact: true,
  // 注意：WXML 不会像 JS 一样解析 `\\uXXXX` 转义序列，必须尽量保留原始 UTF-8 字符。
  jsescOption: { quotes: 'single' as const, minimal: true },
}

function generateExpression(node: t.Expression): string {
  const { code } = generate(node, BABEL_GENERATE_MINI_PROGRAM_OPTIONS)
  return code
}

function parseBabelExpression(exp: string): t.Expression | null {
  const cached = babelExpressionCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      babelExpressionCache.set(exp, false)
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    babelExpressionCache.set(exp, expression)
    return expression
  }
  catch {
    babelExpressionCache.set(exp, false)
    return null
  }
}

export function normalizeClassBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpression(exp)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpression(generateExpression(node)))
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
          context.warnings.push('Spread syntax in :class is not supported in mini-programs, ignoring it')
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
          context.warnings.push('Spread syntax in :class object is not supported in mini-programs, ignoring it')
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
    return [normalizeWxmlExpression(exp)]
  }
  return out
}

export function parseInlineHandler(exp: string): { name: string, args: any[] } | null {
  const cached = inlineHandlerCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression
    if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
      return null
    }
    const name = expression.callee.name
    const args: any[] = []
    for (const arg of expression.arguments) {
      if (t.isIdentifier(arg) && arg.name === '$event') {
        args.push('$event')
      }
      else if (t.isStringLiteral(arg) || t.isNumericLiteral(arg) || t.isBooleanLiteral(arg)) {
        args.push(arg.value)
      }
      else if (t.isNullLiteral(arg)) {
        args.push(null)
      }
      else {
        inlineHandlerCache.set(exp, false)
        return null
      }
    }
    const out = { name, args }
    inlineHandlerCache.set(exp, out)
    return out
  }
  catch {
    inlineHandlerCache.set(exp, false)
    return null
  }
}

function templateLiteralToConcat(node: t.TemplateLiteral): t.Expression {
  const segments: t.Expression[] = []

  node.quasis.forEach((quasi, index) => {
    const cooked = quasi.value.cooked ?? quasi.value.raw ?? ''
    if (cooked) {
      segments.push(t.stringLiteral(cooked))
    }
    if (index < node.expressions.length) {
      let inner = node.expressions[index] as t.Expression
      if (t.isTemplateLiteral(inner)) {
        inner = templateLiteralToConcat(inner)
      }
      segments.push(inner)
    }
  })

  if (segments.length === 0) {
    return t.stringLiteral('')
  }
  if (segments.length === 1) {
    return segments[0]
  }

  return segments.reduce((acc, cur) => t.binaryExpression('+', acc, cur))
}

export function normalizeWxmlExpression(exp: string): string {
  if (!exp.includes('`')) {
    return exp
  }

  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return exp
    }

    traverse(ast, {
      TemplateLiteral(path) {
        if (t.isTaggedTemplateExpression(path.parent)) {
          return
        }
        path.replaceWith(templateLiteralToConcat(path.node))
      },
    })
    const normalized = (stmt as any).expression as t.Expression
    const { code } = generate(normalized, BABEL_GENERATE_MINI_PROGRAM_OPTIONS)
    return code
  }
  catch {
    // 回退：简单把模板字符串改写为字符串拼接
    if (exp.startsWith('`') && exp.endsWith('`')) {
      const inner = exp.slice(1, -1)
      let rewritten = `'${inner.replace(/\$\{([^}]+)\}/g, '\' + ($1) + \'')}'`
      // 移除边界处冗余的 `+ ''`
      rewritten = rewritten.replace(/'\s*\+\s*''/g, '\'').replace(/''\s*\+\s*'/g, '\'')
      rewritten = rewritten.replace(/^\s*''\s*\+\s*/g, '').replace(/\s*\+\s*''\s*$/g, '')
      return rewritten
    }

    return exp
  }
}
