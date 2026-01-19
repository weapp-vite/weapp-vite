import type { DataNode, Element, Node } from 'domhandler'
import { parseDocument } from 'htmlparser2'
import { dirname, relative } from 'pathe'

import { CONTROL_ATTRS, EVENT_KIND_ALIAS, EVENT_PREFIX_RE, normalizeAttributeName, normalizeTagName, SELF_CLOSING_TAGS } from '../shared/wxml'

export interface WxmlCompileOptions {
  id: string
  source: string
  resolveTemplatePath: (raw: string, importer: string) => string | undefined
  resolveWxsPath: (raw: string, importer: string) => string | undefined
}

export interface WxmlCompileResult {
  code: string
  dependencies: string[]
}

interface RenderNode {
  type: 'text' | 'element'
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: RenderNode[]
}

interface TemplateDefinition {
  name: string
  nodes: RenderNode[]
}

interface IncludeEntry {
  id: string
  importName: string
}

interface ImportEntry {
  id: string
  importName: string
}

interface WxsEntry {
  module: string
  kind: 'src' | 'inline'
  importName: string
  value: string
}

function isRenderableNode(node: Node) {
  if (node.type === 'directive' || node.type === 'comment') {
    return false
  }
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? ''
    return data.trim().length > 0
  }
  return true
}

function toRenderNode(node: Node, children?: RenderNode[]): RenderNode | undefined {
  if (node.type === 'text') {
    const data = (node as DataNode).data ?? ''
    return { type: 'text', data }
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    const element = node as Element
    return {
      type: 'element',
      name: element.name,
      attribs: element.attribs ?? {},
      children,
    }
  }
  return undefined
}

function parseWxml(source: string): RenderNode[] {
  const document = parseDocument(source, {
    xmlMode: true,
    decodeEntities: true,
    recognizeSelfClosing: true,
  })
  const nodes = (document.children ?? []).filter(isRenderableNode)
  return nodes
    .map(node => convertNode(node))
    .filter((node): node is RenderNode => Boolean(node))
}

function convertNode(node: Node): RenderNode | undefined {
  if (!isRenderableNode(node)) {
    return undefined
  }
  const children = ('children' in node && node.children?.length)
    ? node.children.map(child => convertNode(child)).filter((child): child is RenderNode => Boolean(child))
    : undefined
  return toRenderNode(node, children)
}

function parseInterpolations(value: string) {
  const parts: Array<{ type: 'text' | 'expr', value: string }> = []
  if (!value.includes('{{')) {
    return [{ type: 'text', value }]
  }
  let cursor = 0
  while (cursor < value.length) {
    const start = value.indexOf('{{', cursor)
    if (start === -1) {
      parts.push({ type: 'text', value: value.slice(cursor) })
      break
    }
    if (start > cursor) {
      parts.push({ type: 'text', value: value.slice(cursor, start) })
    }
    const end = value.indexOf('}}', start + 2)
    if (end === -1) {
      parts.push({ type: 'text', value: value.slice(start) })
      break
    }
    const expr = value.slice(start + 2, end).trim()
    if (expr) {
      parts.push({ type: 'expr', value: expr })
    }
    cursor = end + 2
  }
  return parts
}

function buildExpression(parts: Array<{ type: 'text' | 'expr', value: string }>, scopeVar: string, wxsVar: string) {
  if (parts.length === 0) {
    return '""'
  }
  if (parts.length === 1 && parts[0]?.type === 'text') {
    return JSON.stringify(parts[0].value)
  }
  if (parts.length === 1 && parts[0]?.type === 'expr') {
    return `ctx.eval(${JSON.stringify(parts[0].value)}, ${scopeVar}, ${wxsVar})`
  }
  const segments = parts.map((part) => {
    if (part.type === 'text') {
      return JSON.stringify(part.value)
    }
    return `ctx.eval(${JSON.stringify(part.value)}, ${scopeVar}, ${wxsVar})`
  })
  return `(${segments.join(' + ')})`
}

function extractFor(attribs: Record<string, string>) {
  const expr = attribs['wx:for']
  const itemName = attribs['wx:for-item']?.trim() || 'item'
  let indexName = attribs['wx:for-index']?.trim() || 'index'
  const key = attribs['wx:key']
  const restAttribs: Record<string, string> = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (CONTROL_ATTRS.has(name)) {
      continue
    }
    restAttribs[name] = value
  }
  if (itemName === indexName) {
    indexName = `${indexName}Index`
  }
  return { expr, itemName, indexName, key, restAttribs }
}

function isConditionalElement(node: RenderNode): node is RenderNode & { type: 'element' } {
  if (node.type !== 'element') {
    return false
  }
  const attribs = node.attribs ?? {}
  return 'wx:if' in attribs || 'wx:elif' in attribs || 'wx:else' in attribs
}

function stripControlAttributes(attribs: Record<string, string>) {
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (!CONTROL_ATTRS.has(name)) {
      result[name] = value
    }
  }
  return result
}

function parseEventAttribute(name: string) {
  if (name.includes(':')) {
    const [prefix, rawEvent] = name.split(':', 2)
    return { prefix, rawEvent }
  }
  const match = EVENT_PREFIX_RE.exec(name)
  if (!match) {
    return undefined
  }
  return { prefix: name.slice(0, name.length - match[1].length), rawEvent: match[1] }
}

function renderAttributes(
  attribs: Record<string, string>,
  scopeVar: string,
  wxsVar: string,
  options?: { skipControl?: boolean },
) {
  let buffer = ''
  for (const [rawName, rawValue] of Object.entries(attribs)) {
    if (options?.skipControl && CONTROL_ATTRS.has(rawName)) {
      continue
    }
    const eventInfo = parseEventAttribute(rawName)
    if (eventInfo) {
      const event = eventInfo.rawEvent.toLowerCase()
      const handlerExpr = buildExpression(parseInterpolations(rawValue ?? ''), scopeVar, wxsVar)
      const domEvent = EVENT_KIND_ALIAS[event] ?? event
      const flags = {
        catch: eventInfo.prefix.includes('catch'),
        capture: eventInfo.prefix.includes('capture'),
      }
      buffer += ` @${domEvent}=\${ctx.event(${JSON.stringify(event)}, ${handlerExpr}, ${scopeVar}, ${wxsVar}, ${JSON.stringify(flags)})}`
      continue
    }
    const name = normalizeAttributeName(rawName)
    const expr = buildExpression(parseInterpolations(rawValue ?? ''), scopeVar, wxsVar)
    buffer += ` ${name}=\${${expr}}`
  }
  return buffer
}

function renderNodes(nodes: RenderNode[], scopeVar: string, wxsVar: string): string {
  const parts: string[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (isConditionalElement(node)) {
      const { rendered, endIndex } = renderConditionalSequence(nodes, index, scopeVar, wxsVar)
      parts.push(rendered)
      index = endIndex
      continue
    }
    parts.push(renderNode(node, scopeVar, wxsVar))
  }
  if (parts.length === 0) {
    return '""'
  }
  if (parts.length === 1) {
    return parts[0]!
  }
  return `[${parts.join(', ')}]`
}

function renderConditionalSequence(
  nodes: RenderNode[],
  startIndex: number,
  scopeVar: string,
  wxsVar: string,
) {
  const branches: Array<{ node: RenderNode & { type: 'element' }, attribs: Record<string, string> }> = []
  let cursor = startIndex
  while (cursor < nodes.length) {
    const candidate = nodes[cursor]
    if (!isConditionalElement(candidate)) {
      break
    }
    const attribs = candidate.attribs ?? {}
    if (branches.length === 0 && !('wx:if' in attribs)) {
      break
    }
    if (branches.length > 0 && !('wx:elif' in attribs) && !('wx:else' in attribs)) {
      break
    }
    branches.push({ node: candidate, attribs })
    cursor += 1
    if ('wx:else' in attribs) {
      break
    }
  }
  if (!branches.length) {
    const node = nodes[startIndex]
    return { rendered: renderNode(node, scopeVar, wxsVar), endIndex: startIndex }
  }
  let expr = '""'
  for (let index = branches.length - 1; index >= 0; index -= 1) {
    const { node, attribs } = branches[index]!
    const cleanedAttribs = stripControlAttributes(attribs)
    if ('wx:else' in attribs) {
      expr = renderElement(node, scopeVar, wxsVar, { overrideAttribs: cleanedAttribs })
      continue
    }
    const conditionExpr = attribs['wx:if'] ?? attribs['wx:elif'] ?? ''
    const rendered = renderElement(node, scopeVar, wxsVar, { overrideAttribs: cleanedAttribs })
    const condition = buildExpression(parseInterpolations(conditionExpr), scopeVar, wxsVar)
    expr = `(${condition} ? ${rendered} : ${expr})`
  }
  return { rendered: expr, endIndex: startIndex + branches.length - 1 }
}

function renderNode(node: RenderNode, scopeVar: string, wxsVar: string): string {
  if (node.type === 'text') {
    const parts = parseInterpolations(node.data ?? '')
    return buildExpression(parts, scopeVar, wxsVar)
  }
  if (node.type === 'element') {
    if (node.name === 'template' && node.attribs?.is) {
      return renderTemplateInvoke(node, scopeVar, wxsVar)
    }
    return renderElement(node, scopeVar, wxsVar)
  }
  return '""'
}

function renderTemplateInvoke(node: RenderNode & { type: 'element' }, scopeVar: string, wxsVar: string) {
  const attribs = node.attribs ?? {}
  const isExpr = buildExpression(parseInterpolations(attribs.is ?? ''), scopeVar, wxsVar)
  const dataExpr = attribs.data
    ? buildExpression(parseInterpolations(attribs.data), scopeVar, wxsVar)
    : undefined
  const scopeExpr = dataExpr
    ? `ctx.mergeScope(${scopeVar}, ${dataExpr})`
    : scopeVar
  return `ctx.renderTemplate(__templates, ${isExpr}, ${scopeExpr}, ctx)`
}

function renderElement(
  node: RenderNode & { type: 'element' },
  scopeVar: string,
  wxsVar: string,
  options: { skipFor?: boolean, overrideAttribs?: Record<string, string> } = {},
) {
  const attribs = options.overrideAttribs ?? node.attribs ?? {}
  if (!options.skipFor) {
    const forInfo = extractFor(node.attribs ?? {})
    if (forInfo.expr) {
      const listExpression = buildExpression(parseInterpolations(forInfo.expr), scopeVar, wxsVar)
      const listExpr = `ctx.normalizeList(${listExpression})`
      const itemVar = forInfo.itemName
      const indexVar = forInfo.indexName
      const scopeExpr = `ctx.createScope(${scopeVar}, { ${itemVar}: ${itemVar}, ${indexVar}: ${indexVar} })`
      const itemRender = renderElement(
        node,
        '__scope',
        wxsVar,
        { skipFor: true, overrideAttribs: forInfo.restAttribs },
      )
      const keyExpr = `ctx.key(${JSON.stringify(forInfo.key ?? '')}, ${itemVar}, ${indexVar}, ${scopeExpr}, ${wxsVar})`
      return `repeat(${listExpr}, (${itemVar}, ${indexVar}) => ${keyExpr}, (${itemVar}, ${indexVar}) => { const __scope = ${scopeExpr}; return ${itemRender}; })`
    }
  }

  const tagName = normalizeTagName(node.name ?? '')
  if (tagName === '#fragment') {
    return renderNodes(node.children ?? [], scopeVar, wxsVar)
  }

  const attrs = renderAttributes(attribs, scopeVar, wxsVar, { skipControl: true })
  const childNodes = node.children ?? []
  const children = childNodes.map(child => `\${${renderNode(child, scopeVar, wxsVar)}}`).join('')
  if (SELF_CLOSING_TAGS.has(tagName) && childNodes.length === 0) {
    return `html\`<${tagName}${attrs} />\``
  }
  return `html\`<${tagName}${attrs}>${children}</${tagName}>\``
}

function collectSpecialNodes(nodes: RenderNode[], context: {
  templates: TemplateDefinition[]
  includes: IncludeEntry[]
  imports: ImportEntry[]
  wxs: WxsEntry[]
  resolveTemplate: (raw: string) => string | undefined
  resolveWxs: (raw: string) => string | undefined
}) {
  const renderable: RenderNode[] = []
  for (const node of nodes) {
    if (node.type === 'element') {
      const name = node.name ?? ''
      if (name === 'template' && node.attribs?.name) {
        context.templates.push({
          name: node.attribs.name,
          nodes: collectSpecialNodes(node.children ?? [], context),
        })
        continue
      }
      if (name === 'import' && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.imports.push({
            id: resolved,
            importName: `__wxml_import_${context.imports.length}`,
          })
        }
        continue
      }
      if (name === 'include' && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.includes.push({
            id: resolved,
            importName: `__wxml_include_${context.includes.length}`,
          })
        }
        continue
      }
      if (name === 'wxs') {
        const moduleName = node.attribs?.module?.trim()
        if (moduleName) {
          if (node.attribs?.src) {
            const resolved = context.resolveWxs(node.attribs.src)
            if (resolved) {
              context.wxs.push({
                module: moduleName,
                kind: 'src',
                importName: `__wxs_${context.wxs.length}`,
                value: resolved,
              })
            }
          }
          else {
            const inlineCode = (node.children ?? [])
              .filter(child => child.type === 'text')
              .map(child => child.data ?? '')
              .join('')
            context.wxs.push({
              module: moduleName,
              kind: 'inline',
              importName: `__wxs_${context.wxs.length}`,
              value: inlineCode,
            })
          }
        }
        continue
      }
      if (node.children?.length) {
        node.children = collectSpecialNodes(node.children, context)
      }
    }
    renderable.push(node)
  }
  return renderable
}

function toRelativeImport(from: string, target: string) {
  const fromDir = dirname(from)
  const rel = relative(fromDir, target)
  if (!rel || rel.startsWith('.')) {
    return rel || `./${target.split('/').pop() ?? ''}`
  }
  return `./${rel}`
}

function normalizeTemplatePath(pathname: string) {
  return pathname.split('\\').join('/')
}

export function compileWxml(options: WxmlCompileOptions): WxmlCompileResult {
  const nodes = parseWxml(options.source)
  const templates: TemplateDefinition[] = []
  const includes: IncludeEntry[] = []
  const imports: ImportEntry[] = []
  const wxs: WxsEntry[] = []

  const renderNodesList = collectSpecialNodes(nodes, {
    templates,
    includes,
    imports,
    wxs,
    resolveTemplate: (raw: string) => options.resolveTemplatePath(raw, options.id),
    resolveWxs: (raw: string) => options.resolveWxsPath(raw, options.id),
  })

  const importLines: string[] = [
    `import { html } from 'lit'`,
    `import { repeat } from 'lit/directives/repeat.js'`,
  ]
  const bodyLines: string[] = []
  const dependencies: string[] = []

  for (const entry of imports) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { templates as ${entry.importName} } from '${importPath}'`)
    dependencies.push(entry.id)
  }

  for (const entry of includes) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { render as ${entry.importName} } from '${importPath}'`)
    dependencies.push(entry.id)
  }

  for (const entry of wxs) {
    if (entry.kind === 'src') {
      const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.value))
      importLines.push(`import ${entry.importName} from '${importPath}'`)
      dependencies.push(entry.value)
    }
  }

  if (templates.length > 0 || imports.length > 0) {
    const templatePairs: string[] = []
    for (const entry of imports) {
      templatePairs.push(`...${entry.importName}`)
    }
    for (const template of templates) {
      const rendered = renderNodes(template.nodes, 'scope', '__wxs_modules')
      templatePairs.push(`${JSON.stringify(template.name)}: (scope, ctx) => ${rendered}`)
    }
    bodyLines.push(`const __templates = { ${templatePairs.join(', ')} }`)
  }
  else {
    bodyLines.push(`const __templates = {}`)
  }

  if (wxs.length > 0) {
    bodyLines.push(`const __wxs_inline_cache = Object.create(null)`)
    bodyLines.push(`let __wxs_modules = {}`)
    const wxsMapEntries: string[] = []
    for (const entry of wxs) {
      if (entry.kind === 'inline') {
        const inlineCode = entry.value.trim()
        const cacheKey = JSON.stringify(entry.module)
        if (inlineCode) {
          bodyLines.push(`function ${entry.importName}(ctx) {`)
          bodyLines.push(`  if (!__wxs_inline_cache[${cacheKey}]) {`)
          bodyLines.push(`    __wxs_inline_cache[${cacheKey}] = ctx.createWxsModule(${JSON.stringify(inlineCode)}, ${JSON.stringify(options.id)})`)
          bodyLines.push(`  }`)
          bodyLines.push(`  return __wxs_inline_cache[${cacheKey}]`)
          bodyLines.push(`}`)
        }
        else {
          bodyLines.push(`function ${entry.importName}() { return {} }`)
        }
        wxsMapEntries.push(`${JSON.stringify(entry.module)}: ${entry.importName}(ctx)`)
        continue
      }
      wxsMapEntries.push(`${JSON.stringify(entry.module)}: ${entry.importName}`)
    }
    bodyLines.push(`function __resolveWxsModules(ctx) {`)
    bodyLines.push(`  return { ${wxsMapEntries.join(', ')} }`)
    bodyLines.push(`}`)
  }
  else {
    bodyLines.push(`const __wxs_modules = {}`)
  }

  const includesRender = includes.map(entry => `${entry.importName}(scope, ctx)`)
  const renderContent = renderNodes(renderNodesList, 'scope', '__wxs_modules')
  const contentExpr = includesRender.length > 0
    ? `[${[...includesRender, renderContent].join(', ')}]`
    : renderContent

  bodyLines.push(`export function render(scope, ctx) {`)
  if (wxs.length > 0) {
    bodyLines.push(`  __wxs_modules = __resolveWxsModules(ctx)`)
  }
  bodyLines.push(`  return ${contentExpr}`)
  bodyLines.push(`}`)
  bodyLines.push(`export const templates = __templates`)
  bodyLines.push(`export default render`)

  const code = [...importLines, '', ...bodyLines].join('\n')
  return { code, dependencies }
}
