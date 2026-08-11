import { resolveTemplateExpression } from './templateExpression'

export interface TemplateNodeLike {
  attribs?: Record<string, string>
  children?: TemplateNodeLike[]
  name?: string
  type?: string
}

export interface TemplateRenderState<T extends TemplateNodeLike> {
  definitions: Map<string, T>
  stack: string[]
}

function isTagNode(node: TemplateNodeLike) {
  return node.type === 'tag' && typeof node.name === 'string'
}

function readMustacheExpression(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}')
    ? trimmed.slice(2, -2).trim()
    : trimmed
}

export function createTemplateRenderState<T extends TemplateNodeLike>(root: T): TemplateRenderState<T> {
  const definitions = new Map<string, T>()
  const visit = (node: T) => {
    if (isTagNode(node) && node.name === 'template') {
      const name = node.attribs?.name?.trim()
      if (name) {
        definitions.set(name, node)
      }
    }
    for (const child of node.children ?? []) {
      visit(child as T)
    }
  }
  visit(root)
  return { definitions, stack: [] }
}

export function isTemplateDefinition(node: TemplateNodeLike) {
  return node.name === 'template' && Boolean(node.attribs?.name?.trim())
}

export function resolveTemplateCall(
  node: TemplateNodeLike,
  source: Record<string, any>,
) {
  if (node.name !== 'template' || isTemplateDefinition(node)) {
    return undefined
  }
  const isValue = node.attribs?.is?.trim()
  if (!isValue) {
    return undefined
  }
  const name = isValue.includes('{{')
    ? resolveTemplateExpression(source, readMustacheExpression(isValue))
    : isValue
  return typeof name === 'string' && name ? name : undefined
}

export function resolveTemplateData(
  node: TemplateNodeLike,
  source: Record<string, any>,
) {
  const dataValue = node.attribs?.data?.trim()
  if (!dataValue) {
    return {}
  }
  const expression = readMustacheExpression(dataValue)
  const resolved = resolveTemplateExpression(source, expression)
    ?? resolveTemplateExpression(source, `{${expression}}`)
  return resolved && typeof resolved === 'object'
    ? resolved as Record<string, any>
    : {}
}
