import babel from '@babel/core'
import t from '@babel/types'
import { defu } from '@weapp-core/shared'

export interface TransformWxsCodeOptions {
  filename?: string
}

export function transformWxsCode(code: string, options?: TransformWxsCodeOptions) {
  const { filename } = defu<TransformWxsCodeOptions, TransformWxsCodeOptions[]>(options, {
    filename: 'wxs.ts',
  })
  return babel.transformSync(code, {
    presets: [
      ['@babel/preset-env', {
        targets: {
          node: 0,
        },
      }],
      ['@babel/preset-typescript', {

      }],
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
        },
      },
    ],
  })
}