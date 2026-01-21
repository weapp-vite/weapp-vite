import type { ChildNode, DataNode, Element, Node } from 'domhandler'
import { readFileSync } from 'node:fs'
import { parseDocument } from 'htmlparser2'
import { dirname, relative } from 'pathe'

import { CONTROL_ATTRS, EVENT_KIND_ALIAS, EVENT_PREFIX_RE, normalizeAttributeName, normalizeTagName, SELF_CLOSING_TAGS } from '../shared/wxml'

export interface WxmlCompileOptions {
  id: string
  source: string
  resolveTemplatePath: (raw: string, importer: string) => string | undefined
  resolveWxsPath: (raw: string, importer: string) => string | undefined
  navigationBar?: NavigationBarCompileOptions
  componentTags?: Record<string, string>
  dependencyContext?: WxmlDependencyContext
  expandDependencies?: boolean
}

export interface WxmlCompileResult {
  code: string
  dependencies: string[]
  warnings?: string[]
}

export interface NavigationBarConfig {
  title?: string
  backgroundColor?: string
  textStyle?: string
  frontColor?: string
  loading?: boolean
  navigationStyle?: string
}

export interface NavigationBarCompileOptions {
  config: NavigationBarConfig
}

interface RenderTextNode {
  type: 'text'
  data: string
}

interface RenderElementNode {
  type: 'element'
  name: string
  attribs: Record<string, string>
  children?: RenderNode[]
}

type RenderNode = RenderTextNode | RenderElementNode

interface InterpolationPart {
  type: 'text' | 'expr'
  value: string
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

function shouldMarkWxsImport(pathname: string) {
  const lower = pathname.toLowerCase()
  if (lower.endsWith('.wxs') || lower.endsWith('.wxs.ts') || lower.endsWith('.wxs.js')) {
    return false
  }
  return lower.endsWith('.ts') || lower.endsWith('.js')
}

export interface WxmlDependencyContext {
  warnings: string[]
  dependencies: string[]
  dependencySet: Set<string>
  visited: Set<string>
  active: Set<string>
  circularWarnings: Set<string>
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

type NodeWithChildren = Node & { children: ChildNode[] }

function hasChildren(node: Node): node is NodeWithChildren {
  return Array.isArray((node as NodeWithChildren).children)
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

function convertNode(node: Node): RenderNode | undefined {
  if (!isRenderableNode(node)) {
    return undefined
  }
  const children = (hasChildren(node) && node.children.length > 0)
    ? node.children.map(child => convertNode(child)).filter((child): child is RenderNode => Boolean(child))
    : undefined
  return toRenderNode(node, children)
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

const NAVIGATION_BAR_ATTRS = new Set([
  'title',
  'background-color',
  'text-style',
  'front-color',
  'loading',
])

function stripPageMetaNodes(nodes: RenderNode[]): RenderNode[] {
  const stripped: RenderNode[] = []
  for (const node of nodes) {
    if (node.type === 'element' && node.name === 'page-meta') {
      continue
    }
    if (node.type === 'element' && node.children?.length) {
      const nextChildren = stripPageMetaNodes(node.children)
      if (nextChildren !== node.children) {
        stripped.push({ ...node, children: nextChildren })
        continue
      }
    }
    stripped.push(node)
  }
  return stripped
}

function pickNavigationBarAttrs(attribs: Record<string, string> | undefined) {
  if (!attribs) {
    return undefined
  }
  const picked: Record<string, string> = {}
  for (const [key, value] of Object.entries(attribs)) {
    if (NAVIGATION_BAR_ATTRS.has(key)) {
      picked[key] = value
    }
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}

function findNavigationBarInPageMeta(node: RenderElementNode) {
  const children = node.children ?? []
  for (const child of children) {
    if (child.type === 'element' && child.name === 'navigation-bar') {
      return child
    }
  }
  return undefined
}

function extractNavigationBarFromPageMeta(nodes: RenderNode[]): {
  nodes: RenderNode[]
  attrs?: Record<string, string>
  warnings: string[]
} {
  let pageMetaIndex = -1
  let navigationBar: RenderElementNode | undefined
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type === 'element' && node.name === 'page-meta') {
      if (pageMetaIndex === -1) {
        pageMetaIndex = i
      }
      if (!navigationBar) {
        navigationBar = findNavigationBarInPageMeta(node)
      }
    }
  }
  const warnings: string[] = []
  if (pageMetaIndex > 0) {
    warnings.push('[web] page-meta 需要作为页面第一个节点，已忽略其位置约束。')
  }
  const cleaned = pageMetaIndex === -1 ? nodes : stripPageMetaNodes(nodes)
  const attrs = navigationBar ? pickNavigationBarAttrs(navigationBar.attribs) : undefined
  return { nodes: cleaned, attrs, warnings }
}

function toAttributeValue(value: unknown) {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

function buildNavigationBarAttrs(
  config: NavigationBarConfig | undefined,
  overrides?: Record<string, string>,
) {
  const attrs: Record<string, string> = {}
  if (config?.title !== undefined) {
    const value = toAttributeValue(config.title)
    if (value !== undefined) {
      attrs.title = value
    }
  }
  if (config?.backgroundColor !== undefined) {
    const value = toAttributeValue(config.backgroundColor)
    if (value !== undefined) {
      attrs['background-color'] = value
    }
  }
  if (config?.textStyle !== undefined) {
    const value = toAttributeValue(config.textStyle)
    if (value !== undefined) {
      attrs['text-style'] = value
    }
  }
  if (config?.frontColor !== undefined) {
    const value = toAttributeValue(config.frontColor)
    if (value !== undefined) {
      attrs['front-color'] = value
    }
  }
  if (config?.loading) {
    attrs.loading = 'true'
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      attrs[key] = value
    }
  }
  return attrs
}

function parseInterpolations(value: string): InterpolationPart[] {
  const parts: InterpolationPart[] = []
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

function buildExpression(parts: InterpolationPart[], scopeVar: string, wxsVar: string) {
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

function hasTopLevelColon(expression: string) {
  let depth = 0
  let inSingleQuote = false
  let inDoubleQuote = false
  let inTemplate = false
  let escaped = false
  let sawTopLevelQuestion = false

  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index]!

    if (inSingleQuote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '\'') {
        inSingleQuote = false
      }
      continue
    }
    if (inDoubleQuote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inDoubleQuote = false
      }
      continue
    }
    if (inTemplate) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '`') {
        inTemplate = false
      }
      continue
    }

    if (char === '\'') {
      inSingleQuote = true
      continue
    }
    if (char === '"') {
      inDoubleQuote = true
      continue
    }
    if (char === '`') {
      inTemplate = true
      continue
    }

    if (char === '(' || char === '[' || char === '{') {
      depth += 1
      continue
    }
    if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth !== 0) {
      continue
    }

    if (char === '?') {
      sawTopLevelQuestion = true
      continue
    }
    if (char === ':') {
      return !sawTopLevelQuestion
    }
  }

  return false
}

function shouldWrapShorthandObject(expression: string) {
  const trimmed = expression.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('(')) {
    return false
  }
  return hasTopLevelColon(trimmed)
}

function buildTemplateDataExpression(raw: string, scopeVar: string, wxsVar: string) {
  const trimmed = raw.trim()
  const parts = parseInterpolations(trimmed)
  if (parts.length === 1 && parts[0]?.type === 'expr') {
    const expr = parts[0].value.trim()
    if (expr) {
      const normalizedExpr = shouldWrapShorthandObject(expr) ? `{ ${expr} }` : expr
      return buildExpression([{ type: 'expr', value: normalizedExpr }], scopeVar, wxsVar)
    }
  }
  return buildExpression(parseInterpolations(raw), scopeVar, wxsVar)
}

function createDependencyContext(): WxmlDependencyContext {
  return {
    warnings: [],
    dependencies: [],
    dependencySet: new Set(),
    visited: new Set(),
    active: new Set(),
    circularWarnings: new Set(),
  }
}

function addDependency(
  value: string,
  context: WxmlDependencyContext,
  direct?: string[],
) {
  if (!context.dependencySet.has(value)) {
    context.dependencySet.add(value)
    context.dependencies.push(value)
    direct?.push(value)
  }
}

function warnReadTemplate(context: WxmlDependencyContext, target: string) {
  context.warnings.push(`[web] 无法读取模板依赖: ${target}`)
}

function warnCircularTemplate(
  context: WxmlDependencyContext,
  from: string,
  target: string,
) {
  const key = `${from}=>${target}`
  if (context.circularWarnings.has(key)) {
    return
  }
  context.circularWarnings.add(key)
  context.warnings.push(`[web] WXML 循环引用: ${from} -> ${target}`)
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

function isConditionalElement(node: RenderNode): node is RenderElementNode {
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

function resolveComponentTagName(
  name: string,
  componentTags?: Record<string, string>,
) {
  if (!componentTags) {
    return undefined
  }
  return componentTags[name] ?? componentTags[name.toLowerCase()]
}

const PROPERTY_BIND_EXCLUSIONS = new Set(['class', 'style', 'id', 'slot'])

function shouldBindAsProperty(name: string) {
  if (PROPERTY_BIND_EXCLUSIONS.has(name)) {
    return false
  }
  if (name.startsWith('data-') || name.startsWith('aria-')) {
    return false
  }
  return true
}

function normalizePropertyName(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function renderAttributes(
  attribs: Record<string, string>,
  scopeVar: string,
  wxsVar: string,
  options?: { skipControl?: boolean, preferProperty?: boolean },
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
    const useProperty = options?.preferProperty && shouldBindAsProperty(rawName)
    const name = useProperty ? normalizePropertyName(rawName) : normalizeAttributeName(rawName)
    const expr = buildExpression(parseInterpolations(rawValue ?? ''), scopeVar, wxsVar)
    buffer += ` ${useProperty ? '.' : ''}${name}=\${${expr}}`
  }
  return buffer
}

interface RenderElementOptions {
  skipFor?: boolean
  overrideAttribs?: Record<string, string>
}

class Renderer {
  renderNodes(
    nodes: RenderNode[],
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): string {
    const parts: string[] = []
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      if (isConditionalElement(node)) {
        const { rendered, endIndex } = this.renderConditionalSequence(
          nodes,
          index,
          scopeVar,
          wxsVar,
          componentTags,
        )
        parts.push(rendered)
        index = endIndex
        continue
      }
      parts.push(this.renderNode(node, scopeVar, wxsVar, componentTags))
    }
    if (parts.length === 0) {
      return '""'
    }
    if (parts.length === 1) {
      return parts[0]!
    }
    return `[${parts.join(', ')}]`
  }

  renderConditionalSequence(
    nodes: RenderNode[],
    startIndex: number,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): { rendered: string, endIndex: number } {
    const branches: Array<{ node: RenderElementNode, attribs: Record<string, string> }> = []
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
      if (!node) {
        return { rendered: '""', endIndex: startIndex }
      }
      return { rendered: this.renderNode(node, scopeVar, wxsVar, componentTags), endIndex: startIndex }
    }
    let expr = '""'
    for (let index = branches.length - 1; index >= 0; index -= 1) {
      const { node, attribs } = branches[index]!
      const cleanedAttribs = stripControlAttributes(attribs)
      if ('wx:else' in attribs) {
        expr = this.renderElement(node, scopeVar, wxsVar, componentTags, { overrideAttribs: cleanedAttribs })
        continue
      }
      const conditionExpr = attribs['wx:if'] ?? attribs['wx:elif'] ?? ''
      const rendered = this.renderElement(node, scopeVar, wxsVar, componentTags, { overrideAttribs: cleanedAttribs })
      const condition = buildExpression(parseInterpolations(conditionExpr), scopeVar, wxsVar)
      expr = `(${condition} ? ${rendered} : ${expr})`
    }
    return { rendered: expr, endIndex: startIndex + branches.length - 1 }
  }

  renderNode(
    node: RenderNode,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
  ): string {
    if (node.type === 'text') {
      const parts = parseInterpolations(node.data ?? '')
      return buildExpression(parts, scopeVar, wxsVar)
    }
    if (node.type === 'element') {
      if (node.name === 'template' && node.attribs?.is) {
        return this.renderTemplateInvoke(node, scopeVar, wxsVar, componentTags)
      }
      return this.renderElement(node, scopeVar, wxsVar, componentTags)
    }
    return '""'
  }

  renderTemplateInvoke(
    node: RenderElementNode,
    scopeVar: string,
    wxsVar: string,
    _componentTags?: Record<string, string>,
  ): string {
    const attribs = node.attribs ?? {}
    const isExpr = buildExpression(parseInterpolations(attribs.is ?? ''), scopeVar, wxsVar)
    const dataExpr = attribs.data
      ? buildTemplateDataExpression(attribs.data, scopeVar, wxsVar)
      : undefined
    const scopeExpr = dataExpr
      ? `ctx.mergeScope(${scopeVar}, ${dataExpr})`
      : scopeVar
    return `ctx.renderTemplate(__templates, ${isExpr}, ${scopeExpr}, ctx)`
  }

  renderElement(
    node: RenderElementNode,
    scopeVar: string,
    wxsVar: string,
    componentTags?: Record<string, string>,
    options: RenderElementOptions = {},
  ): string {
    const attribs = options.overrideAttribs ?? node.attribs ?? {}
    if (!options.skipFor) {
      const forInfo = extractFor(node.attribs ?? {})
      if (forInfo.expr) {
        const listExpression = buildExpression(parseInterpolations(forInfo.expr), scopeVar, wxsVar)
        const listExpr = `ctx.normalizeList(${listExpression})`
        const itemVar = forInfo.itemName
        const indexVar = forInfo.indexName
        const scopeExpr = `ctx.createScope(${scopeVar}, { ${itemVar}: ${itemVar}, ${indexVar}: ${indexVar} })`
        const itemRender = this.renderElement(
          node,
          '__scope',
          wxsVar,
          componentTags,
          { skipFor: true, overrideAttribs: forInfo.restAttribs },
        )
        const keyExpr = `ctx.key(${JSON.stringify(forInfo.key ?? '')}, ${itemVar}, ${indexVar}, ${scopeExpr}, ${wxsVar})`
        return `repeat(${listExpr}, (${itemVar}, ${indexVar}) => ${keyExpr}, (${itemVar}, ${indexVar}) => { const __scope = ${scopeExpr}; return ${itemRender}; })`
      }
    }

    const customTag = resolveComponentTagName(node.name ?? '', componentTags)
    const tagName = customTag ?? normalizeTagName(node.name ?? '')
    if (tagName === '#fragment') {
      return this.renderNodes(node.children ?? [], scopeVar, wxsVar, componentTags)
    }

    const attrs = renderAttributes(attribs, scopeVar, wxsVar, {
      skipControl: true,
      preferProperty: Boolean(customTag),
    })
    const childNodes = node.children ?? []
    const children = childNodes
      .map(child => `\${${this.renderNode(child, scopeVar, wxsVar, componentTags)}}`)
      .join('')
    if (SELF_CLOSING_TAGS.has(tagName) && childNodes.length === 0) {
      return `html\`<${tagName}${attrs} />\``
    }
    return `html\`<${tagName}${attrs}>${children}</${tagName}>\``
  }
}

const renderer = new Renderer()

function collectSpecialNodes(nodes: RenderNode[], context: {
  templates: TemplateDefinition[]
  includes: IncludeEntry[]
  imports: ImportEntry[]
  wxs: WxsEntry[]
  wxsModules: Map<string, string>
  warnings: string[]
  sourceId: string
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
      if ((name === 'import' || name === 'wx-import') && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.imports.push({
            id: resolved,
            importName: `__wxml_import_${context.imports.length}`,
          })
        }
        else {
          context.warnings.push(`[web] 无法解析模板依赖: ${node.attribs.src} (from ${context.sourceId})`)
        }
        continue
      }
      if ((name === 'include' || name === 'wx-include') && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.includes.push({
            id: resolved,
            importName: `__wxml_include_${context.includes.length}`,
          })
        }
        else {
          context.warnings.push(`[web] 无法解析模板依赖: ${node.attribs.src} (from ${context.sourceId})`)
        }
        continue
      }
      if (name === 'wxs') {
        const moduleName = node.attribs?.module?.trim()
        if (moduleName) {
          const previousSource = context.wxsModules.get(moduleName)
          if (previousSource) {
            context.warnings.push(`[web] WXS 模块名重复: ${moduleName} (from ${context.sourceId})`)
          }
          context.wxsModules.set(moduleName, context.sourceId)
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
  const dependencyContext = options.dependencyContext ?? createDependencyContext()
  const expandDependencies = options.expandDependencies ?? !options.dependencyContext
  const warnings = dependencyContext.warnings
  const expandDependencyTree = (dependencies: string[], importer: string) => {
    for (const target of dependencies) {
      if (!target) {
        continue
      }
      if (dependencyContext.active.has(target)) {
        warnCircularTemplate(dependencyContext, importer, target)
        continue
      }
      if (dependencyContext.visited.has(target)) {
        continue
      }
      dependencyContext.visited.add(target)
      dependencyContext.active.add(target)
      let source: string
      try {
        source = readFileSync(target, 'utf8')
      }
      catch {
        warnReadTemplate(dependencyContext, target)
        dependencyContext.active.delete(target)
        continue
      }
      try {
        const result = compileWxml({
          id: target,
          source,
          resolveTemplatePath: options.resolveTemplatePath,
          resolveWxsPath: options.resolveWxsPath,
          dependencyContext,
          expandDependencies: false,
        })
        expandDependencyTree(result.dependencies, target)
      }
      catch (error) {
        if (error instanceof Error && error.message) {
          warnings.push(`[web] 无法解析模板依赖: ${target} ${error.message}`)
        }
      }
      dependencyContext.active.delete(target)
    }
  }
  let nodes = parseWxml(options.source)
  let navigationBarAttrs: Record<string, string> | undefined
  if (options.navigationBar) {
    const extracted = extractNavigationBarFromPageMeta(nodes)
    nodes = extracted.nodes
    if (extracted.warnings.length > 0) {
      warnings.push(...extracted.warnings)
    }
    navigationBarAttrs = extracted.attrs
  }
  const templates: TemplateDefinition[] = []
  const includes: IncludeEntry[] = []
  const imports: ImportEntry[] = []
  const wxs: WxsEntry[] = []
  const wxsModules = new Map<string, string>()

  const renderNodesList = collectSpecialNodes(nodes, {
    templates,
    includes,
    imports,
    wxs,
    wxsModules,
    warnings,
    sourceId: options.id,
    resolveTemplate: (raw: string) => options.resolveTemplatePath(raw, options.id),
    resolveWxs: (raw: string) => options.resolveWxsPath(raw, options.id),
  })
  if (options.navigationBar && options.navigationBar.config.navigationStyle !== 'custom') {
    const attrs = buildNavigationBarAttrs(options.navigationBar.config, navigationBarAttrs)
    renderNodesList.unshift({
      type: 'element',
      name: 'weapp-navigation-bar',
      attribs: attrs,
    })
  }

  const importLines: string[] = [
    `import { html } from 'lit'`,
    `import { repeat } from 'lit/directives/repeat.js'`,
  ]
  const bodyLines: string[] = []
  const directDependencies: string[] = []

  for (const entry of imports) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { templates as ${entry.importName} } from '${importPath}'`)
    addDependency(entry.id, dependencyContext, directDependencies)
  }

  for (const entry of includes) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { render as ${entry.importName} } from '${importPath}'`)
    addDependency(entry.id, dependencyContext, directDependencies)
  }

  for (const entry of wxs) {
    if (entry.kind === 'src') {
      const baseImport = normalizeTemplatePath(toRelativeImport(options.id, entry.value))
      const importPath = shouldMarkWxsImport(entry.value)
        ? `${baseImport}?wxs`
        : baseImport
      importLines.push(`import ${entry.importName} from '${importPath}'`)
      addDependency(entry.value, dependencyContext, directDependencies)
    }
  }

  if (templates.length > 0 || imports.length > 0) {
    const templatePairs: string[] = []
    for (const entry of imports) {
      templatePairs.push(`...${entry.importName}`)
    }
    for (const template of templates) {
      const rendered = renderer.renderNodes(template.nodes, 'scope', '__wxs_modules', options.componentTags)
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
  const renderContent = renderer.renderNodes(renderNodesList, 'scope', '__wxs_modules', options.componentTags)
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

  if (expandDependencies) {
    dependencyContext.visited.add(options.id)
    dependencyContext.active.add(options.id)
    expandDependencyTree(directDependencies, options.id)
    dependencyContext.active.delete(options.id)
  }

  const code = [...importLines, '', ...bodyLines].join('\n')
  const dependencies = expandDependencies ? dependencyContext.dependencies : directDependencies
  return {
    code,
    dependencies,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
