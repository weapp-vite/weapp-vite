import * as t from '@babel/types'
import { parse as babelParse, traverse } from '../../../../../utils/babel'
import { generateExpression } from './parse'

type OptionalChainNode = t.OptionalMemberExpression | t.OptionalCallExpression

type OptionalChainOperation
  = | {
    type: 'member'
    optional: boolean
    computed: boolean
    property: t.Expression | t.PrivateName
  }
  | {
    type: 'call'
    optional: boolean
    args: (t.Expression | t.SpreadElement | t.ArgumentPlaceholder)[]
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

function isOptionalChainNode(node: t.Node | null | undefined): node is OptionalChainNode {
  return Boolean(node && (t.isOptionalMemberExpression(node) || t.isOptionalCallExpression(node)))
}

function collectOptionalChain(node: OptionalChainNode): { base: t.Expression, operations: OptionalChainOperation[] } | null {
  const operations: OptionalChainOperation[] = []
  let current: t.Node = node

  while (isOptionalChainNode(current)) {
    if (t.isOptionalMemberExpression(current)) {
      operations.push({
        type: 'member',
        optional: current.optional === true,
        computed: current.computed,
        property: t.cloneNode(current.property),
      })
      current = current.object
      continue
    }
    operations.push({
      type: 'call',
      optional: current.optional === true,
      args: current.arguments.map(arg => t.cloneNode(arg)),
    })
    current = current.callee
  }

  if (!t.isExpression(current)) {
    return null
  }

  return {
    base: t.cloneNode(current),
    operations: operations.reverse(),
  }
}

function applyOptionalChainOperation(base: t.Expression, operation: OptionalChainOperation): t.Expression {
  if (operation.type === 'member') {
    return t.memberExpression(
      base,
      t.cloneNode(operation.property),
      operation.computed,
    )
  }

  return t.callExpression(
    base,
    operation.args.map(arg => t.cloneNode(arg)),
  )
}

function lowerOptionalChain(node: OptionalChainNode): t.Expression {
  const chain = collectOptionalChain(node)
  if (!chain) {
    return t.cloneNode(node) as t.Expression
  }

  const segments: t.Expression[] = [chain.base]
  for (const operation of chain.operations) {
    const currentBase = t.cloneNode(segments[segments.length - 1])
    segments.push(applyOptionalChainOperation(currentBase, operation))
  }

  let lowered = t.cloneNode(segments[segments.length - 1])
  for (let index = chain.operations.length - 1; index >= 0; index--) {
    const operation = chain.operations[index]
    if (!operation.optional) {
      continue
    }
    lowered = t.conditionalExpression(
      t.binaryExpression('==', t.cloneNode(segments[index]), t.nullLiteral()),
      t.identifier('undefined'),
      lowered,
    )
  }

  return lowered
}

export function normalizeWxmlExpression(exp: string): string {
  if (!exp.includes('`') && !exp.includes('??') && !exp.includes('?.')) {
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
      OptionalMemberExpression: {
        exit(path) {
          if (isOptionalChainNode(path.parentPath.node)) {
            return
          }
          path.replaceWith(lowerOptionalChain(path.node))
          path.skip()
        },
      },
      OptionalCallExpression: {
        exit(path) {
          if (isOptionalChainNode(path.parentPath.node)) {
            return
          }
          path.replaceWith(lowerOptionalChain(path.node))
          path.skip()
        },
      },
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
