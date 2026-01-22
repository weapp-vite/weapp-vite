import babel from '@babel/core'
import * as t from '@babel/types'
import { normalizeWxsFilename } from './utils'

export interface TransformWxsCodeOptions {
  filename?: string
  extension?: string
}

export {
  normalizeWxsFilename,
}

export function transformWxsCode(code: string, options?: TransformWxsCodeOptions) {
  const filename = options?.filename ?? 'script.ts'
  const extension = options?.extension ?? 'wxs'
  const importees: Array<{ source: string }> = []

  const maybePushImportee = (value: unknown) => {
    if (typeof value !== 'string' || !value) {
      return
    }
    importees.push({ source: value })
  }

  const tryCollectArgument = (path: babel.NodePath<any>) => {
    const node = path.node
    if (t.isStringLiteral(node)) {
      maybePushImportee(node.value)
      return
    }
    if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
      const value = node.quasis.map(q => q.value.cooked ?? q.value.raw ?? '').join('')
      maybePushImportee(value)
      return
    }
    try {
      const evaluated = path.evaluate()
      if (evaluated.confident) {
        maybePushImportee(evaluated.value)
      }
    }
    catch {
      // 忽略不确定（置信度不足）的求值错误
    }
  }

  const result = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
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
              const node = p.node
              if (!t.isIdentifier(node.callee, { name: 'require' })) {
                return
              }
              if (node.arguments.length !== 1) {
                return
              }

              const argPath = p.get('arguments.0') as babel.NodePath<any>
              tryCollectArgument(argPath)

              const arg = node.arguments[0]
              if (t.isStringLiteral(arg)) {
                arg.value = normalizeWxsFilename(arg.value, extension)
              }
              // 待办：模板字符串
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
              const node = p.node
              if (t.isIdentifier(node.callee, { name: 'RegExp' })) {
                p.replaceWith(
                  t.callExpression(
                    t.identifier('getRegExp'),
                    node.arguments as any,
                  ),
                )
              }
              else if (t.isIdentifier(node.callee, { name: 'Date' })) {
                p.replaceWith(
                  t.callExpression(
                    t.identifier('getDate'),
                    node.arguments as any,
                  ),
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
              const node = p.node
              if (!t.isIdentifier(node.object, { name: 'exports' })) {
                return
              }
              const moduleExports = t.memberExpression(t.identifier('module'), t.identifier('exports'))
              p.replaceWith(
                t.memberExpression(
                  moduleExports,
                  node.property as any,
                  node.computed,
                  (node as any).optional,
                ),
              )
            },
          },
          ImportDeclaration: {
            enter(p) {
              maybePushImportee(p.node.source.value)
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
