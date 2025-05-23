// import type { NodePath } from '@babel/core'
import babel from '@babel/core'
import * as t from '@babel/types'
import { defu } from '@weapp-core/shared'
import { normalizeWxsFilename } from './utils'

export interface TransformWxsCodeOptions {
  filename?: string
  // inline?: boolean
}

export {
  normalizeWxsFilename,
}

export function transformWxsCode(code: string, options?: TransformWxsCodeOptions) {
  const { filename } = defu<TransformWxsCodeOptions, TransformWxsCodeOptions[]>(options, {
    filename: 'script.ts',
  })
  const importees: { source: string }[] = []
  function collect(nodePath: babel.NodePath<babel.types.ArgumentPlaceholder | babel.types.SpreadElement | babel.types.Expression>) {
    const { confident, value } = nodePath.evaluate()
    if (confident) {
      importees.push({
        source: value,
      })
    }
  }

  const result = babel.transformSync(code, {
    presets: [
      ['@babel/preset-env'],
      ['@babel/preset-typescript'],
    ],
    filename,
    plugins: [
      {
        visitor: {
          Directive: {
            enter(p) {
              p.remove()
            },
          },
          CallExpression: {
            enter(p) {
              if (p.get('callee').isIdentifier({
                name: 'require',
              }) && p.get('arguments').length === 1) {
                const importee = p.get('arguments')[0]
                collect(importee)
                if (importee.isStringLiteral()) {
                  importee.node.value = normalizeWxsFilename(importee.node.value)
                }
                // TODO 模板字符串
              }
            },
          },
          ExpressionStatement(p) {
            const expression = p.node.expression

            if (
              expression.type === 'CallExpression'
              && expression.callee.type === 'MemberExpression'
              && t.isIdentifier(expression.callee.object)
              && expression.callee.object.name === 'Object'
              && t.isIdentifier(expression.callee.property)
              && expression.callee.property.name === 'defineProperty'
              && expression.arguments.length >= 2
              && t.isIdentifier(expression.arguments[0])
              && expression.arguments[0].name === 'exports'
              && t.isStringLiteral(expression.arguments[1])
              && expression.arguments[1].value === '__esModule'
            ) {
              p.remove()
            }
          },
          NewExpression: {
            enter(p) {
              if (p.get('callee').isIdentifier({
                name: 'RegExp',
              })) {
                p.replaceWith(
                  t.callExpression(t.identifier('getRegExp'), p.get('arguments').map(x => x.node)),
                )
              }
              else if (p.get('callee').isIdentifier({
                name: 'Date',
              })) {
                p.replaceWith(
                  t.callExpression(t.identifier('getDate'), p.get('arguments').map(x => x.node)),
                )
              }
            },
          },
          RegExpLiteral: {
            enter(p) {
              const args = [t.stringLiteral(p.node.pattern)]
              if (p.node.flags) {
                args.push(t.stringLiteral(p.node.flags))
              }
              p.replaceWith(
                t.callExpression(t.identifier('getRegExp'), args),
              )
            },
          },
          MemberExpression: {
            enter(p) {
              if (p.get('object').isIdentifier({
                name: 'exports',
              })) {
                p.replaceWith(
                  t.memberExpression(
                    t.memberExpression(t.identifier('module'), t.identifier('exports')),
                    p.get('property').node,
                  ),
                )
              }
            },
          },
          ImportDeclaration: {
            enter(p) {
              importees.push(
                {
                  source: p.node.source.value,
                },
              )
            },
          },

        },
      },
    ],
  })

  return {
    result,
    importees,
  }
}
