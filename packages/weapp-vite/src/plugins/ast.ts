import type { Node } from 'estree'
// import type { ProgramNode } from 'rollup'
import { walk } from 'estree-walker'

export function collectRequireTokens(ast: Node) {
  const requireTokens: string[] = []
  const importExpressions: {
    start: number
    end: number
    value: string
  }[] = []
  walk(ast, {
    enter(node) {
      if (node.type === 'CallExpression') {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          if (node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
            requireTokens.push(node.arguments[0].value)
          }
        }
        else if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'require' && node.callee.property.type === 'Identifier' && node.callee.property.name === 'async') {
          if (node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
            requireTokens.push(node.arguments[0].value)
          }
        }
      }
      else if (node.type === 'ImportExpression') {
        importExpressions.push({
          // @ts-ignore
          start: node.start,
          // @ts-ignore
          end: node.start + 'import'.length,
          value: 'require.async',
        })

        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          requireTokens.push(node.source.value)
        }
      }
    },
  })

  return {
    requireTokens,
    importExpressions,
  }
}
