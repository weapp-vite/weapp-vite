import type { NodePath } from '@weapp-vite/ast/babelCore'
import * as t from '@weapp-vite/ast/babelTypes'

/** 从转换前的语法树收集原始引用，避免 Babel 生成的 require 再次成为源文件依赖。 */
export function collectWxsDependencies(program: NodePath<t.Program>): Array<{ source: string }> {
  const values = new Set<string>()
  const add = (value: unknown) => {
    if (typeof value === 'string' && value) {
      values.add(value)
    }
  }
  program.traverse({
    'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration': (reference: NodePath<t.ImportDeclaration | t.ExportNamedDeclaration | t.ExportAllDeclaration>) => {
      if (reference.node.source) {
        add(reference.node.source.value)
      }
    },
    CallExpression(reference: NodePath<t.CallExpression>) {
      if (!t.isIdentifier(reference.node.callee, { name: 'require' }) || reference.scope.getBinding('require') || reference.node.arguments.length !== 1) {
        return
      }
      const argument = reference.get('arguments.0') as NodePath<t.Node>
      if (t.isStringLiteral(argument.node)) {
        add(argument.node.value)
      }
      else if (t.isTemplateLiteral(argument.node) && argument.node.expressions.length === 0) {
        add(argument.node.quasis.map(part => part.value.cooked ?? part.value.raw).join(''))
      }
      else {
        try {
          const evaluated = argument.evaluate()
          if (evaluated.confident) {
            add(evaluated.value)
          }
        }
        catch {
          // 无法静态确定的模块路径由宿主语义检查报告，不猜测运行时结果。
        }
      }
    },
  })
  return [...values].map(source => ({ source }))
}
