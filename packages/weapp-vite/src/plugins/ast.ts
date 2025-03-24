import type { Node } from 'estree'
// import type { ProgramNode } from 'rollup'
import { walk } from 'estree-walker'

export function collectRequireTokens(ast: Node) {
  const requireModules: {
    start: number
    end: number
    value: string
    leadingComment: string
  }[] = []
  const requireTokens: {
    start: number
    end: number
    value: string
  }[] = []
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
            requireModules.push({
              // @ts-ignore
              start: node.arguments[0].start,
              // @ts-ignore
              end: node.arguments[0].end,
              value: node.arguments[0].value,
              leadingComment: '/*sync*/',
            })

            requireTokens.push({
              // @ts-ignore
              start: node.start,
              // @ts-ignore
              end: node.start + 'require'.length,
              value: 'import',
            })
          }
        }
        else if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && node.callee.object.name === 'require' && node.callee.property.type === 'Identifier' && node.callee.property.name === 'async') {
          if (node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
            requireModules.push({
              // @ts-ignore
              start: node.arguments[0].start,
              // @ts-ignore
              end: node.arguments[0].end,
              value: node.arguments[0].value,
              leadingComment: '/*async*/',
            })
            requireTokens.push({
              // @ts-ignore
              start: node.callee.start,
              // @ts-ignore
              end: node.callee.end,
              value: 'import',

            })
          }
        }
      }
      else if (node.type === 'ImportExpression') {
        importExpressions.push({
          // @ts-ignore
          start: node.start,
          // @ts-ignore
          end: node.start + 'import'.length,
          value: 'import',
        })

        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          // requireModules.push(node.source.value)
          requireModules.push({
            // @ts-ignore
            start: node.source.start,
            // @ts-ignore
            end: node.source.end,
            value: node.source.value,
            leadingComment: '/*async*/',
          })
        }
      }
    },
  })

  return {
    requireTokens,
    importExpressions,
    requireModules,
  }
}
