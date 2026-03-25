import type { HeadlessProjectDescriptor } from '../project'
import type { HeadlessPageInstance } from '../runtime'
import fs from 'node:fs'
import path from 'node:path'
import { parseDocument } from 'htmlparser2'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

const LEADING_SLASH_RE = /^\/+/
const TEMPLATE_INTERPOLATION_RE = /\{\{([^{}]+)\}\}/g

function resolveValueByPath(source: Record<string, any>, expression: string) {
  const normalized = expression.trim()
  if (!normalized) {
    return ''
  }
  const segments = normalized.split('.').filter(Boolean)
  let current: any = source
  for (const segment of segments) {
    current = current?.[segment]
  }
  return current ?? ''
}

function interpolateTemplate(input: string, data: Record<string, any>) {
  return input.replace(TEMPLATE_INTERPOLATION_RE, (_match, expression: string) => {
    const value = resolveValueByPath(data, expression)
    return typeof value === 'string' ? value : String(value)
  })
}

function visitDom(node: DomNodeLike, visitor: (node: DomNodeLike) => void) {
  visitor(node)
  for (const child of node.children ?? []) {
    visitDom(child, visitor)
  }
}

function interpolateDomTree(root: DomNodeLike, data: Record<string, any>) {
  visitDom(root, (node) => {
    if (typeof node.data === 'string') {
      node.data = interpolateTemplate(node.data, data)
    }
    if (node.attribs) {
      for (const [key, value] of Object.entries(node.attribs)) {
        node.attribs[key] = interpolateTemplate(value, data)
      }
    }
  })
}

function escapeText(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;')
}

function serializeDomNode(node: DomNodeLike): string {
  if (node.type === 'text') {
    return escapeText(node.data ?? '')
  }

  if (node.type === 'root') {
    return (node.children ?? []).map(serializeDomNode).join('')
  }

  const tagName = node.name ?? ''
  if (!tagName) {
    return (node.children ?? []).map(serializeDomNode).join('')
  }

  const attrs = Object.entries(node.attribs ?? {})
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('')
  const children = (node.children ?? []).map(serializeDomNode).join('')
  return `<${tagName}${attrs}>${children}</${tagName}>`
}

export interface RenderedPageTree {
  root: DomNodeLike
  wxml: string
}

export function renderPageTree(project: HeadlessProjectDescriptor, page: HeadlessPageInstance): RenderedPageTree {
  const route = page.route.replace(LEADING_SLASH_RE, '')
  const templatePath = path.resolve(project.miniprogramRootPath, `${route}.wxml`)
  const templateSource = fs.readFileSync(templatePath, 'utf8')
  const document = parseDocument(`<page>${templateSource}</page>`, {
    xmlMode: false,
    decodeEntities: false,
    recognizeSelfClosing: true,
  }) as unknown as DomNodeLike

  interpolateDomTree(document, page.data)

  return {
    root: document,
    wxml: serializeDomNode((document.children ?? [])[0] ?? document),
  }
}
