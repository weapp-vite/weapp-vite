import babel from '@babel/core'
import t from '@babel/types'

describe('babel', () => {
  it('should 0', async () => {
    const res = await babel.transform(`export const foo = "'hello world' from comm.wxs";
export const bar = function (d: string) {
  return d;
}
`, {
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
      filename: 'script.ts',
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
            // MemberExpression: {
            //   enter(p) {
            //     if (p.get('object').isIdentifier({ name: 'Object' }) && p.get('property').isIdentifier({ name: 'defineProperty' }) && p.parentPath.isMemberExpression()) {
            //       p.parentPath.remove()
            //     }
            //   },
            // },
          },
        },
      ],
    })

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })

  it('should 1', async () => {
    const res = await babel.transform(`export const foo = "'hello world' from comm.wxs";
export const bar = function (d) {
  return d;
}
`, {
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
      filename: 'script.ts',
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
            // MemberExpression: {
            //   enter(p) {
            //     if (p.get('object').isIdentifier({ name: 'Object' }) && p.get('property').isIdentifier({ name: 'defineProperty' }) && p.parentPath.isMemberExpression()) {
            //       p.parentPath.remove()
            //     }
            //   },
            // },
          },
        },
      ],
    })

    if (res) {
      expect(res.code).toMatchSnapshot()
    }
  })
})
