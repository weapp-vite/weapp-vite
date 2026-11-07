import type { Node } from '@babel/types'
import { parseExpression } from '@babel/parser'
import { buildExpression, buildTemplateDataExpression, normalizeTemplateDataExpression } from './interpolation'

/** 编译时保留每个模板参数的读取来源，运行时无需解析 AST。 */
export function buildTemplateDataSources(raw: string, wxsVar: string) {
  const expression = normalizeTemplateDataExpression(raw)
  const reader = (value: string) => `__sourceScope => ${buildExpression([{ type: 'expr', value }], '__sourceScope', wxsVar)}`
  const fallback = () => `[{ spread: true, read: __sourceScope => ${buildTemplateDataExpression(raw, '__sourceScope', wxsVar)} }]`
  if (!expression) {
    return fallback()
  }
  try {
    // 节点均来自本次 parseExpression，位置始终对应同一份 expression。
    const source = (value: Node) => expression.slice(value.start!, value.end!)
    const structured = (node: Node) => ['ObjectExpression', 'ConditionalExpression', 'LogicalExpression', 'ArrayExpression'].includes(node.type)
    const build = (node: Node): string => {
      if (node.type === 'ConditionalExpression') {
        return `[{ read: ${reader(source(node.test))}, consequent: ${build(node.consequent)}, alternate: ${build(node.alternate)} }]`
      }
      if (node.type === 'LogicalExpression') {
        const condition = node.operator === '??' ? `(${source(node.left)}) != null` : source(node.left)
        const consequent = node.operator === '&&' ? node.right : node.left
        const alternate = node.operator === '&&' ? node.left : node.right
        return `[{ read: ${reader(condition)}, consequent: ${build(consequent)}, alternate: ${build(alternate)} }]`
      }
      const entry = (key: string, value: Node) => `{ key: ${key}, read: ${reader(source(value))}${structured(value) ? `, object: ${build(value)}` : ''} }`
      if (node.type === 'ArrayExpression' && node.elements.every(value => value && value.type !== 'SpreadElement')) {
        return `[${node.elements.map((value, index) => entry(JSON.stringify(String(index)), value!)).join(', ')}]`
      }
      if (node.type !== 'ObjectExpression') {
        return `[{ spread: true, read: ${reader(source(node))} }]`
      }
      const entries: string[] = []
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          entries.push(...[build(property.argument).slice(1, -1)].filter(Boolean))
        }
        else if (property.type === 'ObjectProperty') {
          const key = property.computed
            ? reader(source(property.key))
            : JSON.stringify(property.key.type === 'Identifier' ? property.key.name : String((property.key as { value: unknown }).value))
          entries.push(entry(key, property.value))
        }
        else {
          return `[{ spread: true, read: ${reader(source(node))} }]`
        }
      }
      return `[${entries.join(', ')}]`
    }
    return build(parseExpression(expression))
  }
  catch {
    return fallback()
  }
}
