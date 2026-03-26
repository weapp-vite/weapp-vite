import type { HeadlessComponentDefinition } from '../host'
import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { HeadlessComponentInstance } from '../runtime/componentInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import { parseDocument } from 'htmlparser2'
import { dirname, join, normalize } from 'pathe'
import {
  createComponentInstance,
  runComponentPageLifetime,
  runComponentObservers,
} from '../runtime/componentInstance'
import type { BrowserModuleLoader } from './moduleLoader'
import { type BrowserVirtualFiles, readBrowserVirtualFile } from './virtualFiles'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

interface BrowserRenderScope {
  data: Record<string, any>
  getMethod: (methodName: string) => ((...args: any[]) => any) | undefined
  getScopeId: () => string
}

interface BrowserComponentRegistryEntry {
  definition: HeadlessComponentDefinition
  filePath: string
  templatePath: string
}

export interface BrowserRenderedPageTree {
  root: DomNodeLike
  wxml: string
}

export interface BrowserRendererContext {
  componentCache: Map<string, HeadlessComponentInstance>
  componentScopes: Map<string, BrowserRenderScope>
  files: BrowserVirtualFiles
  moduleLoader: BrowserModuleLoader
  project: HeadlessProjectDescriptor
}

const LEADING_SLASH_RE = /^\/+/
const TEMPLATE_INTERPOLATION_RE = /\{\{([^{}]+)\}\}/g
const EVENT_BINDING_ATTRS = ['bindtap', 'bind:tap']
const COMPONENT_EVENT_PREFIXES = ['bind:', 'bind']

function escapeText(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;')
}

function cloneNode(node: DomNodeLike): DomNodeLike {
  return {
    ...node,
    attribs: node.attribs ? { ...node.attribs } : undefined,
    children: node.children?.map(child => cloneNode(child)),
  }
}

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

function readTemplateSource(files: BrowserVirtualFiles, filePath: string) {
  const templateSource = readBrowserVirtualFile(files, filePath)
  if (typeof templateSource !== 'string') {
    throw new Error(`Missing template in browser simulator runtime: ${filePath}`)
  }
  return templateSource
}

function parseTemplateDocument(templateSource: string) {
  return parseDocument(`<page>${templateSource}</page>`, {
    xmlMode: false,
    decodeEntities: false,
    recognizeSelfClosing: true,
  }) as unknown as DomNodeLike
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

function isTagNode(node: DomNodeLike): node is DomNodeLike & { name: string, type: string } {
  return node.type === 'tag' && typeof node.name === 'string'
}

function isMustacheOnly(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') && trimmed.indexOf('{{', 2) === -1
}

function resolveAttributeValue(value: string, scope: BrowserRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveValueByPath(scope.data, expression)
  }
  return interpolateTemplate(value, scope.data)
}

function resolveUsingComponents(
  files: BrowserVirtualFiles,
  ownerJsonPath: string,
  ownerFilePath: string,
) {
  const ownerJson = readBrowserVirtualFile(files, ownerJsonPath)
  if (typeof ownerJson !== 'string') {
    return new Map<string, string>()
  }

  try {
    const parsed = JSON.parse(ownerJson) as Record<string, any>
    const usingComponents = parsed.usingComponents
    if (!usingComponents || typeof usingComponents !== 'object' || Array.isArray(usingComponents)) {
      return new Map<string, string>()
    }

    const resolved = new Map<string, string>()
    for (const [alias, rawPath] of Object.entries(usingComponents)) {
      if (typeof rawPath !== 'string') {
        continue
      }
      const basePath = rawPath.startsWith('/')
        ? rawPath.replace(LEADING_SLASH_RE, '')
        : normalize(join(dirname(ownerFilePath), rawPath))
      resolved.set(alias, basePath.replace(LEADING_SLASH_RE, ''))
    }
    return resolved
  }
  catch {
    return new Map<string, string>()
  }
}

function resolveComponentRegistryEntry(
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  alias: string,
) {
  const usingComponents = resolveUsingComponents(context.files, ownerJsonPath, ownerFilePath)
  const componentBasePath = usingComponents.get(alias)
  if (!componentBasePath) {
    return null
  }

  const filePath = `${componentBasePath}.js`
  const templatePath = `${componentBasePath}.wxml`
  const definition = context.moduleLoader.executeComponentModule(filePath, componentBasePath)
  return {
    definition,
    filePath,
    templatePath,
  } satisfies BrowserComponentRegistryEntry
}

function buildComponentTrigger(
  hostNode: DomNodeLike,
  hostScope: BrowserRenderScope,
) {
  const eventBindings = new Map<string, string>()
  for (const [key, value] of Object.entries(hostNode.attribs ?? {})) {
    const matchedPrefix = COMPONENT_EVENT_PREFIXES.find(prefix => key.startsWith(prefix))
    if (!matchedPrefix) {
      continue
    }
    const eventName = key.slice(matchedPrefix.length)
    if (!eventName) {
      continue
    }
    eventBindings.set(eventName, value)
  }

  return (eventName: string, detail?: unknown) => {
    const handlerName = eventBindings.get(eventName)
    if (!handlerName) {
      return
    }
    const handler = hostScope.getMethod(handlerName)
    handler?.({
      detail,
      type: eventName,
    })
  }
}

function applyNodeBindings(node: DomNodeLike, scope: BrowserRenderScope) {
  if (!isTagNode(node)) {
    if (node.type === 'text' && typeof node.data === 'string') {
      node.data = interpolateTemplate(node.data, scope.data)
    }
    return
  }

  node.attribs ??= {}
  node.attribs['data-sim-scope'] = scope.getScopeId()

  for (const [key, value] of Object.entries(node.attribs)) {
    if (EVENT_BINDING_ATTRS.includes(key)) {
      node.attribs['data-sim-tap'] = value
      continue
    }
    node.attribs[key] = typeof value === 'string'
      ? String(resolveAttributeValue(value, scope))
      : String(value)
  }
}

function syncComponentProperties(
  instance: HeadlessComponentInstance,
  definition: HeadlessComponentDefinition,
  nextProperties: Record<string, any>,
) {
  const changedRootKeys: string[] = []
  for (const [key, value] of Object.entries(nextProperties)) {
    if (instance.properties[key] !== value) {
      instance.properties[key] = value
      changedRootKeys.push(key)
    }
  }

  if (changedRootKeys.length === 0) {
    return
  }

  runComponentObservers(definition, instance, changedRootKeys)
}

function createMergedScopeData(
  pageData: Record<string, any>,
  componentProperties: Record<string, any>,
  componentData: Record<string, any>,
) {
  return {
    ...pageData,
    ...componentProperties,
    ...componentData,
  }
}

function renderNodeTree(
  node: DomNodeLike,
  scope: BrowserRenderScope,
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  seenComponentScopes: Set<string>,
): DomNodeLike {
  const clonedNode = cloneNode(node)
  if (!isTagNode(clonedNode)) {
    applyNodeBindings(clonedNode, scope)
    return clonedNode
  }

  const componentEntry = resolveComponentRegistryEntry(context, ownerJsonPath, ownerFilePath, clonedNode.name)
  if (componentEntry) {
    const componentScopeId = `${instancePath}/${clonedNode.name}`
    const nextProperties: Record<string, any> = {}
    for (const [key, value] of Object.entries(clonedNode.attribs ?? {})) {
      if (key.startsWith('bind')) {
        continue
      }
      nextProperties[key] = resolveAttributeValue(String(value), scope)
    }

    let componentInstance = context.componentCache.get(componentScopeId)
    if (!componentInstance) {
      componentInstance = createComponentInstance({
        definition: componentEntry.definition,
        properties: nextProperties,
        triggerEvent: buildComponentTrigger(clonedNode, scope),
      })
      runComponentObservers(componentEntry.definition, componentInstance, Object.keys(nextProperties))
      componentEntry.definition.lifetimes?.attached?.call(componentInstance)
      runComponentPageLifetime(componentInstance, 'show')
      context.componentCache.set(componentScopeId, componentInstance)
    }
    else {
      syncComponentProperties(componentInstance, componentEntry.definition, nextProperties)
    }

    seenComponentScopes.add(componentScopeId)

    const componentScope: BrowserRenderScope = {
      data: createMergedScopeData(scope.data, componentInstance.properties, componentInstance.data),
      getMethod: (methodName: string) => {
        const method = componentInstance?.[methodName]
        return typeof method === 'function' ? method : undefined
      },
      getScopeId: () => componentScopeId,
    }
    context.componentScopes.set(componentScopeId, componentScope)

    const componentTemplate = readTemplateSource(context.files, componentEntry.templatePath)
    const componentDocument = parseTemplateDocument(componentTemplate)
    const componentRoot = (componentDocument.children ?? [])[0] ?? componentDocument
    const renderedComponentRoot: DomNodeLike = renderNodeTree(
      componentRoot,
      componentScope,
      context,
      `${componentEntry.filePath.replace(/\.js$/, '')}.json`,
      componentEntry.filePath,
      componentScopeId,
      seenComponentScopes,
    )
    if (renderedComponentRoot.attribs) {
      renderedComponentRoot.attribs['data-sim-component'] = clonedNode.name
    }
    return renderedComponentRoot
  }

  applyNodeBindings(clonedNode, scope)
  clonedNode.children = (clonedNode.children ?? []).map((child, index) => renderNodeTree(
    child,
    scope,
    context,
    ownerJsonPath,
    ownerFilePath,
    `${instancePath}/${clonedNode.name}-${index}`,
    seenComponentScopes,
  ))
  return clonedNode
}

export function renderBrowserPageTree(
  context: BrowserRendererContext,
  page: HeadlessPageInstance,
): BrowserRenderedPageTree {
  const route = page.route.replace(LEADING_SLASH_RE, '')
  const templatePath = join(context.project.miniprogramRootPath, `${route}.wxml`)
  const templateSource = readTemplateSource(context.files, templatePath)
  const document = parseTemplateDocument(templateSource)
  const pageScopeId = `page:${route}`
  const pageScope: BrowserRenderScope = {
    data: page.data,
    getMethod: (methodName: string) => {
      const method = page[methodName]
      return typeof method === 'function' ? method : undefined
    },
    getScopeId: () => pageScopeId,
  }
  context.componentScopes.clear()
  context.componentScopes.set(pageScopeId, pageScope)
  const seenComponentScopes = new Set<string>()
  const root = (document.children ?? [])[0] ?? document
  const renderedRoot = renderNodeTree(
    root,
    pageScope,
    context,
    `${route}.json`,
    `${route}.js`,
    pageScopeId,
    seenComponentScopes,
  )

  for (const [scopeId, instance] of [...context.componentCache.entries()]) {
    if (!seenComponentScopes.has(scopeId)) {
      instance.__definition__?.lifetimes?.detached?.call(instance)
      context.componentCache.delete(scopeId)
      context.componentScopes.delete(scopeId)
    }
  }

  return {
    root: renderedRoot,
    wxml: serializeDomNode(renderedRoot),
  }
}
