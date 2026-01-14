import * as t from '@babel/types'
import { parse as babelParse, traverse } from '../../../../../utils/babel'
import { generateExpression } from './parse'

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
  if (!exp.includes('`') && !exp.includes('??')) {
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
      LogicalExpression(path) {
        if (path.node.operator !== '??') {
          return
        }
        const left = path.node.left
        const right = path.node.right
        const test = t.binaryExpression('!=', t.cloneNode(left), t.nullLiteral())
        path.replaceWith(t.conditionalExpression(test, t.cloneNode(left), t.cloneNode(right)))
        path.skip()
      },
      TemplateLiteral(path) {
        if (t.isTaggedTemplateExpression(path.parent)) {
          return
        }
        path.replaceWith(templateLiteralToConcat(path.node))
      },
    })
    const normalized = (stmt as any).expression as t.Expression
    return generateExpression(normalized)
  }
  catch {
    if (exp.startsWith('`') && exp.endsWith('`')) {
      const inner = exp.slice(1, -1)
      let rewritten = `'${inner.replace(/\$\{([^}]+)\}/g, '\' + ($1) + \'')}'`
      rewritten = rewritten.replace(/'\s*\+\s*''/g, '\'').replace(/''\s*\+\s*'/g, '\'')
      rewritten = rewritten.replace(/^\s*''\s*\+\s*/g, '').replace(/\s*\+\s*''\s*$/g, '')
      return rewritten
    }

    return exp
  }
}
