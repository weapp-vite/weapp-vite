import type { Diagnostic } from '../types'
import { traverse } from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'

/** Filter 是百度旧版模板能力，不能套用 SJS 的模块规则。 */
export function checkFilterRules(ast: Parameters<typeof traverse>[0], sourceLength: number): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const add = (code: string, message: string, node: t.Node) => {
    diagnostics.push({ code: `script/filter-${code}`, message, severity: 'error', start: Math.min(sourceLength, node.start ?? 0), end: Math.min(sourceLength, node.end ?? 0) })
  }
  traverse(ast, {
    ConditionalExpression(path) {
      add('conditional', '百度 Filter 不支持三目运算；请使用 if 语句或迁移到 SJS。', path.node)
    },
    ExportNamedDeclaration(path) {
      add('export', '百度 Filter 使用 export default 对象暴露函数。', path.node)
    },
    ExportAllDeclaration(path) {
      add('export', '百度 Filter 使用 export default 对象暴露函数。', path.node)
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.get('declaration')
      const value = declaration.isIdentifier() ? declaration.resolve() : declaration
      if (!value.isObjectExpression()) {
        return
      }
      for (const property of value.get('properties')) {
        if (property.isObjectMethod() && property.node.kind === 'method') {
          continue
        }
        if (!property.isObjectProperty()) {
          continue
        }
        const value = property.get('value')
        const resolved = value.isIdentifier() ? value.resolve() : value
        if (resolved.isFunction()) {
          continue
        }
        if (resolved.isLiteral() || resolved.isObjectExpression() || resolved.isArrayExpression()) {
          add('export-value', '百度 Filter 只能导出函数，不能导出普通数据。', value.node)
        }
      }
    },
    AssignmentExpression(path) {
      const left = path.node.left
      if (t.isMemberExpression(left) && t.isIdentifier(left.object, { name: 'module' }) && t.isIdentifier(left.property, { name: 'exports' }) && !path.scope.getBinding('module')) {
        add('export', '百度 Filter 使用 export default 对象暴露函数，不使用 module.exports。', left)
      }
    },
  })
  return diagnostics
}
