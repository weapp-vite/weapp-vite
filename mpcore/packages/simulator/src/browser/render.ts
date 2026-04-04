import type { HeadlessComponentDefinition } from '../host'
import type { HeadlessProjectDescriptor } from '../project/createProjectDescriptor'
import type { HeadlessComponentInstance } from '../runtime/componentInstance'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type { BrowserModuleLoader } from './moduleLoader'
import type { BrowserVirtualFiles } from './virtualFiles'
import { parseDocument } from 'htmlparser2'
import { dirname, join, normalize } from 'pathe'
import {
  cloneValue,
  createComponentInstance,
  normalizeComponentPropertyValue,
  runComponentLifecycle,
  runComponentObservers,
  runComponentPageLifetime,
} from '../runtime/componentInstance'
import { readBrowserVirtualFile } from './virtualFiles'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

interface BrowserRenderScope {
  alias?: string
  classList?: string[]
  data: Record<string, any>
  dataset?: Record<string, string>
  eventBindings?: Map<string, { method: string, stopAfter: boolean }>
  getMethod: (methodName: string) => ((...args: any[]) => any) | undefined
  getScopeId: () => string
  hostId?: string
  listenerScopeId?: string
  id?: string
  ownerScopeId?: string
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
  changedPageKeys: string[]
  componentCache: Map<string, HeadlessComponentInstance>
  componentScopes: Map<string, BrowserRenderScope>
  files: BrowserVirtualFiles
  moduleLoader: BrowserModuleLoader
  project: HeadlessProjectDescriptor
  session: {
    createIntersectionObserver: (scope: any, options?: Record<string, any>) => any
    createMediaQueryObserver: (scope: any) => any
    selectAllComponentsWithin: (scopeId: string, selector: string) => any[]
    selectComponentWithin: (scopeId: string, selector: string) => any
    selectOwnerComponent: (scopeId: string) => any
  }
}

const LEADING_SLASH_RE = /^\/+/
const TEMPLATE_INTERPOLATION_RE = /\{\{([^{}]+)\}\}/g
const EVENT_BINDING_ATTRS = ['bindtap', 'bind:tap', 'catchtap', 'catch:tap']
const COMPONENT_EVENT_PREFIXES = ['bind:', 'bind', 'catch:', 'catch']
const STRUCTURAL_ATTRS = ['wx:if', 'wx:elif', 'wx:else', 'wx:for', 'wx:for-item', 'wx:for-index', 'wx:key']
const WX_ELSE_ATTRS = new Set(['wx:elif', 'wx:else'])
const DATASET_NAME_RE = /-([a-z])/g
const BRACKET_INDEX_RE = /\[(\d+)\]/g
const CLASS_SPLIT_RE = /\s+/
const JS_FILE_RE = /\.js$/

function isMustacheOnly(value: string) {
  const trimmed = value.trim()
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') && !trimmed.includes('{{', 2)
}

function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

function collectDataset(node: DomNodeLike) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!key.startsWith('data-') || key === 'data-sim-scope' || key === 'data-sim-tap' || key === 'data-sim-component') {
      continue
    }
    dataset[toDatasetKey(key)] = String(value)
  }
  return dataset
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

function cloneNode(node: DomNodeLike): DomNodeLike {
  return {
    ...node,
    attribs: node.attribs ? { ...node.attribs } : undefined,
    children: node.children?.map(child => cloneNode(child)),
  }
}

function parseExpressionSegments(expression: string) {
  return expression
    .replace(BRACKET_INDEX_RE, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

function unwrapMustacheExpression(expression: string) {
  const normalized = expression.trim()
  if (isMustacheOnly(normalized)) {
    return normalized.slice(2, -2).trim()
  }
  return normalized
}

function resolveLiteralValue(expression: string) {
  if (expression === 'true') {
    return true
  }
  if (expression === 'false') {
    return false
  }
  if (expression === 'null') {
    return null
  }
  if (expression === 'undefined') {
    return undefined
  }
  if ((expression.startsWith('"') && expression.endsWith('"')) || (expression.startsWith('\'') && expression.endsWith('\''))) {
    return expression.slice(1, -1)
  }
  const numericValue = Number(expression)
  if (!Number.isNaN(numericValue) && expression !== '') {
    return numericValue
  }
  return undefined
}

function resolveValueByExpression(source: Record<string, any>, expression: string): unknown {
  const normalized = unwrapMustacheExpression(expression)
  if (!normalized) {
    return undefined
  }

  if (normalized.startsWith('!')) {
    return !resolveValueByExpression(source, normalized.slice(1))
  }

  const literalValue = resolveLiteralValue(normalized)
  if (literalValue !== undefined || normalized === 'undefined') {
    return literalValue
  }

  const segments = parseExpressionSegments(normalized)
  let current: any = source
  for (const segment of segments) {
    current = current?.[segment]
  }
  return current
}

function resolveValueByPath(source: Record<string, any>, expression: string) {
  return resolveValueByExpression(source, expression) ?? ''
}

function resolveRawValueByPath(source: Record<string, any>, expression: string) {
  return resolveValueByExpression(source, expression)
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
    throw new TypeError(`Missing template in browser simulator runtime: ${filePath}`)
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

function isIgnorableTextNode(node: DomNodeLike) {
  return node.type === 'text' && typeof node.data === 'string' && node.data.trim() === ''
}

function resolveAttributeValue(value: string, scope: BrowserRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveValueByPath(scope.data, expression)
  }
  return interpolateTemplate(value, scope.data)
}

function resolveComponentAttributeValue(value: string, scope: BrowserRenderScope) {
  if (isMustacheOnly(value)) {
    const expression = value.trim().slice(2, -2)
    return resolveRawValueByPath(scope.data, expression)
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

function collectComponentEventBindings(hostNode: DomNodeLike) {
  const eventBindings = new Map<string, { method: string, stopAfter: boolean }>()
  for (const [key, value] of Object.entries(hostNode.attribs ?? {})) {
    const matchedPrefix = COMPONENT_EVENT_PREFIXES.find(prefix => key.startsWith(prefix))
    if (!matchedPrefix) {
      continue
    }
    const eventName = key.slice(matchedPrefix.length)
    if (!eventName) {
      continue
    }
    eventBindings.set(eventName, {
      method: value,
      stopAfter: matchedPrefix.startsWith('catch'),
    })
  }

  return eventBindings
}

function buildComponentTrigger(
  componentScopeId: string,
  context: BrowserRendererContext,
  hostNode: DomNodeLike,
) {
  const hostDataset = collectDataset(hostNode)
  const hostId = hostNode.attribs?.id ?? ''

  return (
    instance: HeadlessComponentInstance,
    eventName: string,
    detail?: unknown,
    triggerOptions?: Record<string, any>,
  ) => {
    const interactionTarget = instance.__lastInteractionEvent__?.target
    const interactionCurrentTarget = instance.__lastInteractionEvent__?.currentTarget
    const interactionMark = instance.__lastInteractionEvent__?.mark
    const target = {
      dataset: interactionTarget?.dataset ?? hostDataset,
      id: interactionTarget?.id ?? hostId,
    }
    let currentScopeId: string | undefined = componentScopeId

    while (currentScopeId) {
      const currentScope = context.componentScopes.get(currentScopeId)
      const binding = currentScope?.eventBindings?.get(eventName)
      const listenerScope = currentScope?.listenerScopeId
        ? context.componentScopes.get(currentScope.listenerScopeId)
        : null
      const handler = binding && listenerScope
        ? listenerScope.getMethod(binding.method)
        : undefined

      if (handler) {
        handler({
          bubbles: triggerOptions?.bubbles ?? false,
          capturePhase: false,
          composed: triggerOptions?.composed ?? false,
          detail,
          mark: interactionMark,
          target,
          type: eventName,
          currentTarget: {
            dataset: currentScope?.dataset ?? interactionCurrentTarget?.dataset ?? hostDataset,
            id: currentScope?.hostId ?? interactionCurrentTarget?.id ?? hostId,
          },
        })
      }

      if (binding?.stopAfter) {
        break
      }
      if (!triggerOptions?.bubbles || !triggerOptions?.composed) {
        break
      }
      currentScopeId = currentScope?.ownerScopeId
    }
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

  for (const key of STRUCTURAL_ATTRS) {
    delete node.attribs[key]
  }

  for (const [key, value] of Object.entries({ ...node.attribs })) {
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
  bindingExpressions: Record<string, string | undefined>,
  changedPageKeys: string[],
) {
  const changedRootKeys: string[] = []
  const previousProperties: Record<string, any> = {}
  for (const [key, value] of Object.entries(nextProperties)) {
    const nextValue = normalizeComponentPropertyValue(definition, key, value)
    const bindingExpression = bindingExpressions[key]
    const bindingAffected = !!bindingExpression && changedPageKeys.some((changedKey) => {
      return changedKey === bindingExpression
        || changedKey.startsWith(`${bindingExpression}.`)
        || changedKey.startsWith(`${bindingExpression}[`)
    })
    const previousSnapshot = instance.__propertySnapshots?.[key]
    const deepChanged = bindingAffected && JSON.stringify(previousSnapshot) !== JSON.stringify(nextValue)
    if (instance.properties[key] !== nextValue || deepChanged) {
      previousProperties[key] = instance.properties[key]
      instance.properties[key] = nextValue
      changedRootKeys.push(key)
    }
    instance.__propertySnapshots ??= {}
    instance.__propertySnapshots[key] = cloneValue(nextValue)
  }

  if (changedRootKeys.length === 0) {
    return
  }

  runComponentObservers(definition, instance, changedRootKeys, previousProperties)
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

function isTruthy(value: unknown) {
  return Boolean(value)
}

function createLoopScope(scope: BrowserRenderScope, itemName: string, indexName: string, item: unknown, index: number): BrowserRenderScope {
  return {
    ...scope,
    data: {
      ...scope.data,
      [indexName]: index,
      [itemName]: item,
    },
  }
}

function evaluateConditionalBranch(node: DomNodeLike, scope: BrowserRenderScope) {
  const condition = node.attribs?.['wx:if'] ?? node.attribs?.['wx:elif']
  if (condition == null) {
    return true
  }
  return isTruthy(resolveRawValueByPath(scope.data, condition))
}

function expandNodeByFor(node: DomNodeLike, scope: BrowserRenderScope) {
  const forExpression = node.attribs?.['wx:for']
  if (!forExpression) {
    return [{ node, scope, instanceSuffix: '' }]
  }

  const list = resolveRawValueByPath(scope.data, forExpression)
  const items = Array.isArray(list) ? list : []
  const itemName = node.attribs?.['wx:for-item']?.trim() || 'item'
  const indexName = node.attribs?.['wx:for-index']?.trim() || 'index'

  return items.map((item, index) => ({
    node: cloneNode(node),
    scope: createLoopScope(scope, itemName, indexName, item, index),
    instanceSuffix: `:for-${index}`,
  }))
}

function renderNodeVariants(
  node: DomNodeLike,
  scope: BrowserRenderScope,
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  seenComponentScopes: Set<string>,
) {
  // eslint-disable-next-line ts/no-use-before-define
  return expandNodeByFor(node, scope).map(({ node: expandedNode, scope: expandedScope, instanceSuffix }) => renderNodeTree(
    expandedNode,
    expandedScope,
    context,
    ownerJsonPath,
    ownerFilePath,
    `${instancePath}${instanceSuffix}`,
    seenComponentScopes,
  ))
}

function renderChildren(
  children: DomNodeLike[],
  scope: BrowserRenderScope,
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  seenComponentScopes: Set<string>,
) {
  const renderedChildren: DomNodeLike[] = []

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!
    if (!isTagNode(child)) {
      renderedChildren.push(...renderNodeVariants(
        child,
        scope,
        context,
        ownerJsonPath,
        ownerFilePath,
        `${instancePath}/node-${index}`,
        seenComponentScopes,
      ))
      continue
    }

    const hasConditional = child.attribs?.['wx:if'] != null
    const isElseBranch = child.attribs?.['wx:elif'] != null || child.attribs?.['wx:else'] != null

    if (hasConditional) {
      let branchMatched = false
      let cursor = index
      while (cursor < children.length) {
        const branch = children[cursor]!
        if (cursor !== index && isIgnorableTextNode(branch)) {
          cursor += 1
          continue
        }
        if (!isTagNode(branch)) {
          break
        }
        if (cursor !== index && !WX_ELSE_ATTRS.has(Object.keys(branch.attribs ?? {}).find(key => key.startsWith('wx:')) ?? '')) {
          break
        }

        const isElseOnly = branch.attribs?.['wx:else'] != null
        const shouldRender = isElseOnly ? !branchMatched : (!branchMatched && evaluateConditionalBranch(branch, scope))
        if (shouldRender) {
          renderedChildren.push(...renderNodeVariants(
            branch,
            scope,
            context,
            ownerJsonPath,
            ownerFilePath,
            `${instancePath}/node-${cursor}`,
            seenComponentScopes,
          ))
          branchMatched = true
        }

        let nextBranchIndex = cursor + 1
        while (nextBranchIndex < children.length && isIgnorableTextNode(children[nextBranchIndex]!)) {
          nextBranchIndex += 1
        }
        const nextBranch = children[nextBranchIndex]
        const hasNextElseBranch = !!nextBranch
          && isTagNode(nextBranch)
          && (nextBranch.attribs?.['wx:elif'] != null || nextBranch.attribs?.['wx:else'] != null)
        if (!hasNextElseBranch) {
          break
        }
        cursor = nextBranchIndex
      }
      index = cursor
      continue
    }

    if (isElseBranch) {
      continue
    }

    renderedChildren.push(...renderNodeVariants(
      child,
      scope,
      context,
      ownerJsonPath,
      ownerFilePath,
      `${instancePath}/node-${index}`,
      seenComponentScopes,
    ))
  }

  return renderedChildren
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
    const ownerScopeId = scope.getScopeId().includes('/') ? scope.getScopeId() : undefined
    const nextProperties: Record<string, any> = {}
    const bindingExpressions: Record<string, string | undefined> = {}
    for (const [key, value] of Object.entries(clonedNode.attribs ?? {})) {
      if (key.startsWith('bind')) {
        continue
      }
      if (isMustacheOnly(String(value))) {
        bindingExpressions[key] = String(value).trim().slice(2, -2).trim()
      }
      nextProperties[key] = resolveComponentAttributeValue(String(value), scope)
    }

    let componentInstance = context.componentCache.get(componentScopeId)
    if (!componentInstance) {
      componentInstance = createComponentInstance({
        definition: componentEntry.definition,
        properties: nextProperties,
        triggerEvent: buildComponentTrigger(componentScopeId, context, clonedNode),
      })
      componentInstance.createIntersectionObserver = (options?: Record<string, any>) => context.session.createIntersectionObserver(componentInstance, options)
      componentInstance.createMediaQueryObserver = () => context.session.createMediaQueryObserver(componentInstance)
      componentInstance.selectComponent = (selector: string) => context.session.selectComponentWithin(componentScopeId, selector)
      componentInstance.selectAllComponents = (selector: string) => context.session.selectAllComponentsWithin(componentScopeId, selector)
      componentInstance.selectOwnerComponent = () => ownerScopeId ? context.session.selectOwnerComponent(componentScopeId) : null
      runComponentLifecycle(componentInstance, 'created')
      runComponentObservers(componentInstance.__definition__ ?? componentEntry.definition, componentInstance, Object.keys(nextProperties), {})
      componentInstance.__propertySnapshots = Object.fromEntries(
        Object.entries(componentInstance.properties).map(([key, propertyValue]) => [key, cloneValue(propertyValue)]),
      )
      runComponentLifecycle(componentInstance, 'attached')
      runComponentPageLifetime(componentInstance, 'show')
      context.componentCache.set(componentScopeId, componentInstance)
    }
    else {
      syncComponentProperties(
        componentInstance,
        componentInstance.__definition__ ?? componentEntry.definition,
        nextProperties,
        bindingExpressions,
        context.changedPageKeys,
      )
    }

    seenComponentScopes.add(componentScopeId)

    const componentScope: BrowserRenderScope = {
      alias: clonedNode.name,
      classList: String(clonedNode.attribs?.class ?? '')
        .split(CLASS_SPLIT_RE)
        .map(item => item.trim())
        .filter(Boolean),
      data: createMergedScopeData(scope.data, componentInstance.properties, componentInstance.data),
      dataset: collectDataset(clonedNode),
      eventBindings: collectComponentEventBindings(clonedNode),
      getMethod: (methodName: string) => {
        const method = componentInstance?.[methodName]
        return typeof method === 'function' ? method : undefined
      },
      getScopeId: () => componentScopeId,
      hostId: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
      id: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
      listenerScopeId: scope.getScopeId(),
      ownerScopeId,
    }
    context.componentScopes.set(componentScopeId, componentScope)

    const componentTemplate = readTemplateSource(context.files, componentEntry.templatePath)
    const componentDocument = parseTemplateDocument(componentTemplate)
    const componentRoot = (componentDocument.children ?? [])[0] ?? componentDocument
    const renderedComponentRoot: DomNodeLike = renderNodeTree(
      componentRoot,
      componentScope,
      context,
      `${componentEntry.filePath.replace(JS_FILE_RE, '')}.json`,
      componentEntry.filePath,
      componentScopeId,
      seenComponentScopes,
    )
    if (renderedComponentRoot.attribs) {
      renderedComponentRoot.attribs['data-sim-component'] = clonedNode.name
    }
    if (!componentInstance.__ready__) {
      runComponentLifecycle(componentInstance, 'ready')
      componentInstance.__ready__ = true
    }
    return renderedComponentRoot
  }

  applyNodeBindings(clonedNode, scope)
  clonedNode.children = renderChildren(
    clonedNode.children ?? [],
    scope,
    context,
    ownerJsonPath,
    ownerFilePath,
    `${instancePath}/${clonedNode.name}`,
    seenComponentScopes,
  )
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
    id: 'page-root',
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
      runComponentLifecycle(instance, 'detached')
      context.componentCache.delete(scopeId)
      context.componentScopes.delete(scopeId)
    }
  }

  return {
    root: renderedRoot,
    wxml: serializeDomNode(renderedRoot),
  }
}
