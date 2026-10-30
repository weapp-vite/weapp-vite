import { parse } from '@weapp-vite/ast'
import { attributesFromRows } from './html.ts'

interface SyntaxNode {
  type?: string
  name?: string
  value?: unknown
  property?: SyntaxNode
  arguments?: SyntaxNode[]
  properties?: SyntaxNode[]
  key?: SyntaxNode
  elements?: SyntaxNode[]
  [key: string]: unknown
}

function children(node: SyntaxNode): SyntaxNode | undefined {
  return node.arguments?.[1]?.properties?.find(property => property.key?.name === 'children' || property.key?.value === 'children')?.value as SyntaxNode | undefined
}

function tagName(node: SyntaxNode) {
  return node.type === 'CallExpression' ? node.arguments?.[0]?.property?.name : undefined
}

function collect(node: SyntaxNode | undefined, tag: string): SyntaxNode[] {
  if (!node) {
    return []
  }
  if (tagName(node) === tag) {
    return [node]
  }
  return Object.values(node).flatMap(value => value && typeof value === 'object'
    ? Array.isArray(value) ? value.flatMap(child => collect(child as SyntaxNode, tag)) : collect(value as SyntaxNode, tag)
    : [])
}

function text(node: SyntaxNode | undefined): string {
  if (!node) {
    return ''
  }
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') {
    return String(node.value)
  }
  if (node.type === 'ArrayExpression') {
    return (node.elements ?? []).map(text).join('')
  }
  return text(children(node))
}

/** 只静态读取官方文档编译后的 JSX 属性表，绝不执行远端 JavaScript。 */
export function attributesFromCompiledDocs(source: string) {
  const ast = parse(source, { sourceType: 'unambiguous' }) as unknown as SyntaxNode
  const rows = collect(ast, 'table').flatMap(table => collect(children(table), 'tr').map(row => collect(children(row), 'th').concat(collect(children(row), 'td')).map(cell => text(children(cell)).trim())))
  const tables = collect(ast, 'table').flatMap(table => attributesFromRows(collect(children(table), 'tr').map(row => collect(children(row), 'th').concat(collect(children(row), 'td')).map(cell => text(children(cell)).trim()))))
  return { attributes: [...new Map(tables.map(attribute => [attribute.name, attribute])).values()], rows }
}
