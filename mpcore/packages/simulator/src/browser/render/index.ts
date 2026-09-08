import type { HeadlessPageInstance } from '../../runtime/pageInstance'
import type { TemplateRenderState } from '../../view/templateRuntime'
import type { BrowserRenderedPageTree, BrowserRendererContext, BrowserRenderScope, BrowserSlotContent, DomNodeLike } from './types'
import { join } from 'pathe'
import { attachComponentPage, isComponentPageAttaching } from '../../host/componentPageAttachment'
import { runComponentLifecycle, runComponentPageLifetime } from '../../runtime/componentInstance'
import { flushComponentAttachments, flushComponentReady, hasPendingComponentAttachments } from '../../runtime/componentInstance/attachment'
import { syncComponentRelations } from '../../runtime/componentInstance/relations'
import { isPageBeforeReady } from '../../runtime/pageLifecycle'
import { selectConditionalChildren } from '../../view/conditionalChildren'
import { customTabBarHostScope, hasCustomTabBar } from '../../view/customTabBar'
import { resolveLoopEntries } from '../../view/loopEntries'
import { linkRenderedParents } from '../../view/renderedTree'
import { isTemplateDefinition, resolveTemplateCall, resolveTemplateData } from '../../view/templateRuntime'
import { wxsScopeData } from '../../view/wxs'
import { resolveBrowserPageStyles } from '../styles'
import { resolveBrowserComponentPageStyleIsolation } from '../styles/componentPage'
import { getBrowserWxsLoader } from '../wxs'
import {
  createBrowserComponentInstance,
  createComponentScope,
  renderBrowserComponentTemplate,
  resolveComponentGenerics,
  resolveComponentProperties,
  resolveComponentRegistryEntry,
  syncComponentProperties,
} from './component'
import {
  applyNodeBindings,
  cloneNode,
  createLoopScope,
  evaluateConditionalBranch,
  isTagNode,
  LEADING_SLASH_RE,
  parseTemplateDocument,
  prepareTemplateRenderState,
  readTemplateSource,
  resolveRawValueByPath,
  serializeDomNode,
} from './shared'

function expandNodeByFor(node: DomNodeLike, scope: BrowserRenderScope) {
  const forExpression = node.attribs?.['wx:for']
  if (!forExpression) {
    return [{ node, scope, instanceSuffix: '' }]
  }

  const list = resolveRawValueByPath(wxsScopeData(scope), forExpression)
  const items = resolveLoopEntries(list)
  const itemName = node.attribs?.['wx:for-item']?.trim() || 'item'
  const indexName = node.attribs?.['wx:for-index']?.trim() || 'index'

  return items.map(([index, item]) => ({
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
  templateRenderState: TemplateRenderState<DomNodeLike>,
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
    templateRenderState,
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
  templateRenderState: TemplateRenderState<DomNodeLike>,
) {
  const renderedChildren: DomNodeLike[] = []

  for (const { node: child, index } of selectConditionalChildren(children, node => evaluateConditionalBranch(node, scope))) {
    if (!isTagNode(child)) {
      renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, seenComponentScopes, templateRenderState))
      continue
    }

    if (isTemplateDefinition(child) || child.name === 'import' || child.name === 'wxs') {
      continue
    }

    renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, seenComponentScopes, templateRenderState))
  }

  return renderedChildren
}

function collectComponentSlots(
  componentNode: DomNodeLike,
  scope: BrowserRenderScope,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  templateRenderState: TemplateRenderState<DomNodeLike>,
) {
  const slots = new Map<string, BrowserSlotContent[]>()
  ;(componentNode.children ?? []).forEach((node, index) => {
    const slotName = isTagNode(node) && typeof node.attribs?.slot === 'string' && node.attribs.slot.trim()
      ? node.attribs.slot.trim()
      : 'default'
    const entries = slots.get(slotName) ?? []
    entries.push({
      instancePath: `${instancePath}/slot-${slotName}/node-${index}`,
      node,
      ownerFilePath,
      ownerJsonPath,
      scope,
      templateRenderState,
    })
    slots.set(slotName, entries)
  })
  for (const key of Object.keys(componentNode.attribs ?? {})) {
    const prefix = 'generic:scoped-slots-'
    if (!key.startsWith(prefix)) {
      continue
    }
    const slotName = key.slice(prefix.length)
    const inherited = scope.slots?.get(slotName)
    if (slotName && inherited?.length && !slots.has(slotName)) {
      slots.set(slotName, inherited)
    }
  }
  if (componentNode.name?.startsWith('scoped-slots-') && !slots.has('default')) {
    const slotName = componentNode.name.slice('scoped-slots-'.length)
    const inherited = scope.slots?.get(slotName)
    if (inherited?.length) {
      slots.set('default', inherited)
    }
  }
  return slots
}

function renderNodeTree(
  node: DomNodeLike,
  scope: BrowserRenderScope,
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  seenComponentScopes: Set<string>,
  templateRenderState: TemplateRenderState<DomNodeLike>,
): DomNodeLike {
  if (scope.wxs !== templateRenderState.wxsModules) {
    scope = { ...scope, wxs: templateRenderState.wxsModules }
  }
  const clonedNode = cloneNode(node)
  if (!isTagNode(clonedNode)) {
    applyNodeBindings(clonedNode, scope)
    return clonedNode
  }

  if (isTemplateDefinition(clonedNode)) {
    return {
      type: 'tag',
      name: 'block',
      attribs: {},
      children: [],
    }
  }

  const templateName = resolveTemplateCall(clonedNode, wxsScopeData(scope))
  if (templateName) {
    const definition = templateRenderState.definitions.get(templateName)
    const templateScope = {
      ...scope,
      data: resolveTemplateData(clonedNode, wxsScopeData(scope)),
      wxs: definition && templateRenderState.definitionWxsScopes?.get(definition),
    }
    const children = definition && !templateRenderState.stack.includes(templateName)
      ? renderChildren(
          definition.children ?? [],
          templateScope,
          context,
          ownerJsonPath,
          ownerFilePath,
          `${instancePath}/template-${templateName}`,
          seenComponentScopes,
          {
            definitions: templateRenderState.definitionScopes?.get(definition) ?? templateRenderState.definitions,
            definitionScopes: templateRenderState.definitionScopes,
            definitionWxsScopes: templateRenderState.definitionWxsScopes,
            wxsModules: templateScope.wxs,
            stack: [...templateRenderState.stack, templateName],
          },
        )
      : []
    return {
      type: 'tag',
      name: 'block',
      attribs: {
        'data-sim-node': instancePath,
        'data-sim-scope': scope.getScopeId(),
      },
      children,
    }
  }

  if (clonedNode.name === 'slot') {
    const slotName = clonedNode.attribs?.name?.trim() || 'default'
    const projected = scope.slots?.get(slotName) ?? []
    const children = projected.length
      ? selectConditionalChildren(
          projected.map(entry => entry.node),
          (node, index) => evaluateConditionalBranch(node, projected[index]!.scope),
        ).flatMap(({ index }) => {
          const entry = projected[index]!
          return renderNodeVariants(
            entry.node,
            entry.scope,
            context,
            entry.ownerJsonPath,
            entry.ownerFilePath,
            entry.instancePath,
            seenComponentScopes,
            entry.templateRenderState,
          )
        })
      : renderChildren(
          clonedNode.children ?? [],
          scope,
          context,
          ownerJsonPath,
          ownerFilePath,
          `${instancePath}/slot-fallback-${slotName}`,
          seenComponentScopes,
          templateRenderState,
        )
    return {
      type: 'tag',
      name: 'block',
      attribs: { 'data-sim-scope': scope.getScopeId() },
      children,
    }
  }

  const componentEntry = resolveComponentRegistryEntry(
    context,
    ownerJsonPath,
    ownerFilePath,
    clonedNode.name,
    scope.genericComponents?.get(clonedNode.name),
  )
  if (componentEntry) {
    const componentScopeId = `${instancePath}/${clonedNode.name}`
    const ownerScopeId = scope.getScopeId().includes('/') ? scope.getScopeId() : undefined
    const { nextProperties, bindingExpressions } = resolveComponentProperties(clonedNode, scope, componentEntry.definition)

    let componentInstance = context.componentCache.get(componentScopeId)
    if (!componentInstance) {
      componentInstance = createBrowserComponentInstance(
        componentScopeId,
        context,
        clonedNode,
        componentEntry,
        nextProperties,
        ownerScopeId,
      )
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

    const genericComponents = resolveComponentGenerics(
      context,
      clonedNode,
      ownerJsonPath,
      ownerFilePath,
      componentEntry.filePath,
    )
    const slots = collectComponentSlots(
      clonedNode,
      scope,
      ownerJsonPath,
      ownerFilePath,
      componentScopeId,
      templateRenderState,
    )
    const componentScope = createComponentScope(
      clonedNode,
      scope,
      componentScopeId,
      componentInstance,
      genericComponents,
      slots,
    )
    context.componentScopes.set(componentScopeId, componentScope)

    const renderedComponentRoot = renderBrowserComponentTemplate(
      context,
      componentEntry,
      renderNodeTree,
      componentScope,
      componentScopeId,
      seenComponentScopes,
    )
    if (renderedComponentRoot.attribs) {
      applyNodeBindings(clonedNode, scope)
      renderedComponentRoot.attribs = { ...clonedNode.attribs, ...renderedComponentRoot.attribs }
      renderedComponentRoot.attribs['data-sim-component'] = clonedNode.name
      renderedComponentRoot.attribs['data-sim-scope'] = componentScopeId
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
    templateRenderState,
  )
  return clonedNode
}

export function renderBrowserPageTree(
  context: BrowserRendererContext,
  page: HeadlessPageInstance,
): BrowserRenderedPageTree {
  const route = page.route.replace(LEADING_SLASH_RE, '')
  const routeRecord = context.project.routes.find(item => item.route === route)
  const resourcePath = routeRecord?.resourcePath ?? route
  const templatePath = join(context.project.miniprogramRootPath, `${resourcePath}.wxml`)
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
  for (const scopeId of context.componentScopes.keys()) {
    if (scopeId === pageScopeId || scopeId.startsWith(`${pageScopeId}/`)) {
      context.componentScopes.delete(scopeId)
    }
  }
  context.componentScopes.set(pageScopeId, pageScope)
  const seenComponentScopes = new Set<string>()
  const root = (document.children ?? [])[0] ?? document
  const templateRenderState = prepareTemplateRenderState(context.files, root, templatePath, context.project.miniprogramRootPath, getBrowserWxsLoader(context.moduleLoader, context.files))
  const renderedRoot = renderNodeTree(
    root,
    pageScope,
    context,
    `${resourcePath}.json`,
    `${resourcePath}.js`,
    pageScopeId,
    seenComponentScopes,
    templateRenderState,
  )

  const roots = [renderedRoot]
  if (hasCustomTabBar(context.project.appConfig, route)) {
    roots.push(renderNodeTree(
      { type: 'tag', name: 'custom-tab-bar', attribs: {}, children: [] },
      customTabBarHostScope(),
      context,
      'app.json',
      'app.js',
      pageScopeId,
      seenComponentScopes,
      templateRenderState,
    ))
  }

  // Component 页面先创建子树，再执行页面 created/attached，最后统一挂载后代。
  const pageAttached = attachComponentPage(page)
  const pageAttaching = isComponentPageAttaching(page)
  const attached = !pageAttaching && flushComponentAttachments(
    [...seenComponentScopes].map(scopeId => context.componentCache.get(scopeId)!),
    (instance) => {
      runComponentLifecycle(instance, 'attached')
      runComponentPageLifetime(instance, 'show')
    },
  )
  // detached 仍能读取旧关系；真实宿主随后解除双方关系并调用 unlinked。
  const removed = [...context.componentCache].filter(([scopeId]) => scopeId.startsWith(`${pageScopeId}/`) && !seenComponentScopes.has(scopeId))
  for (const [, instance] of removed) {
    runComponentLifecycle(instance, 'detached')
  }
  const instances = [...seenComponentScopes].map(scopeId => context.componentCache.get(scopeId)!)
  const relationsChanged = !pageAttaching && !hasPendingComponentAttachments(instances) && syncComponentRelations(context.componentCache, seenComponentScopes, pageScopeId)
  for (const [scopeId] of removed) {
    context.componentCache.delete(scopeId)
    context.componentScopes.delete(scopeId)
  }

  if (pageAttached || attached || relationsChanged) {
    return renderBrowserPageTree(context, page)
  }

  if (!isPageBeforeReady(page) && flushComponentReady(instances, instance => runComponentLifecycle(instance, 'ready'))) {
    return renderBrowserPageTree(context, page)
  }

  const treeRoot: DomNodeLike = roots.length > 1 ? { type: 'root', children: roots } : renderedRoot
  linkRenderedParents(treeRoot)
  return {
    root: treeRoot,
    styles: resolveBrowserPageStyles(context.files, resourcePath, {
      miniprogramRootPath: context.project.miniprogramRootPath,
      styleIsolation: resolveBrowserComponentPageStyleIsolation(context.files, page, resourcePath, context.project.miniprogramRootPath),
    }),
    wxml: roots.map(serializeDomNode).join(''),
  }
}

export type { BrowserRenderedPageTree, BrowserRendererContext } from './types'
