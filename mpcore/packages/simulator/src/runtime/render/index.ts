import type { RenderPass } from '../../view/renderPass'
import type { TemplateRenderState } from '../../view/templateRuntime'
import type { HeadlessComponentInstance } from '../componentInstance'
import type { HeadlessPageInstance } from '../pageInstance'
import type { DomNodeLike, RuntimeRenderedPageTree, RuntimeRendererContext, RuntimeRenderScope, RuntimeSlotContent } from './types'
import path from 'node:path'
import { bindAttachmentBindingScope, runWithAttachmentBindingUpdates } from '../../host/attachmentBindingUpdates'
import { attachComponentPage, isComponentPageAttaching } from '../../host/componentPageAttachment'
import { bindComponentEventHost, mergeComponentEventRoot, orderComponentAttachmentScopes, registerComponentEventNode } from '../../view/componentEvent'
import { selectConditionalChildren } from '../../view/conditionalChildren'
import { customTabBarHostScope, customTabBarScopeId, hasCustomTabBar } from '../../view/customTabBar'
import { registerInspectionTrees } from '../../view/inspectionTree'
import { resolveLoopEntries, resolveLoopInstanceSuffix } from '../../view/loopEntries'
import { linkRenderedParents } from '../../view/renderedTree'
import { createPageRenderPass, createRenderPass, isRenderPassStale, markPageTreeConstructed, registerSlotDeclarations } from '../../view/renderPass'
import { isTemplateDefinition, resolveTemplateCall, resolveTemplateData } from '../../view/templateRuntime'
import { wxsScopeData } from '../../view/wxs'
import { runComponentLifecycle } from '../componentInstance'
import { flushComponentAttachments, flushComponentReady, hasPendingComponentAttachments, isComponentAttached } from '../componentInstance/attachment'
import { hasPendingComponentConstruction, isComponentConstructing } from '../componentInstance/construction'
import { flushDiscardedComponentReady, scheduleDiscardedComponentReady } from '../componentInstance/discardedReady'
import { syncComponentProperties } from '../componentInstance/propertyBindings'
import { syncComponentRelations } from '../componentInstance/relations'
import { isPageBeforeReady } from '../pageLifecycle'
import { getRuntimeWxsLoader } from '../wxs'
import {
  createComponentScope,
  createRuntimeComponentInstance,
  renderRuntimeComponentTemplate,
  resolveComponentGenerics,
  resolveComponentProperties,
  resolveComponentRegistryEntry,
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

function expandNodeByFor(node: DomNodeLike, scope: RuntimeRenderScope) {
  const forExpression = node.attribs?.['wx:for']
  if (!forExpression) {
    return [{ node, scope, instanceSuffix: '' }]
  }

  const list = resolveRawValueByPath(wxsScopeData(scope), forExpression)
  const items = resolveLoopEntries(list)
  const itemName = node.attribs?.['wx:for-item']?.trim() || 'item'
  const indexName = node.attribs?.['wx:for-index']?.trim() || 'index'
  const key = node.attribs?.['wx:key']?.trim()
  const keyOccurrences = key ? new Map<string, number>() : undefined

  return items.map(([index, item]) => ({
    node: cloneNode(node),
    scope: createLoopScope(scope, itemName, indexName, item, index),
    instanceSuffix: resolveLoopInstanceSuffix(item, index, key, keyOccurrences),
  }))
}

function renderNodeVariants(
  node: DomNodeLike,
  scope: RuntimeRenderScope,
  context: RuntimeRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  renderPass: RenderPass,
  templateRenderState: TemplateRenderState<DomNodeLike>,
  parent: DomNodeLike,
) {
  const nodes: DomNodeLike[] = []
  if (isRenderPassStale(renderPass)) {
    return nodes
  }
  for (const { node: expandedNode, scope: expandedScope, instanceSuffix } of expandNodeByFor(node, scope)) {
    if (isRenderPassStale(renderPass)) {
      break
    }
    // eslint-disable-next-line ts/no-use-before-define
    nodes.push(renderNodeTree(
      expandedNode,
      expandedScope,
      context,
      ownerJsonPath,
      ownerFilePath,
      `${instancePath}${instanceSuffix}`,
      renderPass,
      templateRenderState,
      parent,
    ))
  }
  return nodes
}

function renderChildren(
  children: DomNodeLike[],
  scope: RuntimeRenderScope,
  context: RuntimeRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  renderPass: RenderPass,
  templateRenderState: TemplateRenderState<DomNodeLike>,
  parent: DomNodeLike,
) {
  const renderedChildren: DomNodeLike[] = []

  for (const { node: child, index } of selectConditionalChildren(children, node => evaluateConditionalBranch(node, scope))) {
    if (isRenderPassStale(renderPass)) {
      break
    }
    if (!isTagNode(child)) {
      renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, renderPass, templateRenderState, parent))
      continue
    }

    if (isTemplateDefinition(child) || child.name === 'import' || child.name === 'wxs') {
      continue
    }

    renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, renderPass, templateRenderState, parent))
  }

  return renderedChildren
}

function collectComponentSlots(
  componentNode: DomNodeLike,
  scope: RuntimeRenderScope,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  templateRenderState: TemplateRenderState<DomNodeLike>,
) {
  const slots = new Map<string, RuntimeSlotContent[]>()
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

function reconcileSlotDeclarations(context: RuntimeRendererContext, renderPass: RenderPass) {
  // 实际投影优先建立事件路径；未投影的声明仍参与实例生命周期，但不加入可见树。
  for (const [entries, { parent, scopeId }] of renderPass.slotDeclarations) {
    if (isRenderPassStale(renderPass)) {
      return
    }
    if (isComponentConstructing(context.componentCache.get(scopeId))) {
      continue
    }
    for (const { index } of selectConditionalChildren(
      entries.map(entry => entry.node),
      (node, index) => evaluateConditionalBranch(node, entries[index]!.scope),
    )) {
      if (isRenderPassStale(renderPass)) {
        return
      }
      const entry = entries[index]!
      if (renderPass.renderedSlots.has(entry)) {
        continue
      }
      const nodes = renderNodeVariants(entry.node, entry.scope, context, entry.ownerJsonPath, entry.ownerFilePath, entry.instancePath, renderPass, entry.templateRenderState, parent)
      renderPass.renderedSlots.set(entry, nodes)
      renderPass.hasUnprojectedSlots ||= nodes.length > 0
    }
  }
}

function renderNodeTree(
  node: DomNodeLike,
  scope: RuntimeRenderScope,
  context: RuntimeRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
  renderPass: RenderPass,
  templateRenderState: TemplateRenderState<DomNodeLike>,
  parent?: DomNodeLike,
): DomNodeLike {
  if (isRenderPassStale(renderPass)) {
    return node
  }
  if (scope.wxs !== templateRenderState.wxsModules) {
    scope = { ...scope, wxs: templateRenderState.wxsModules }
  }
  const clonedNode = cloneNode(node)
  registerComponentEventNode(clonedNode, scope, parent)
  if (!isTagNode(clonedNode)) {
    applyNodeBindings(clonedNode, scope)
    return clonedNode
  }

  if (isTemplateDefinition(clonedNode)) {
    clonedNode.name = 'block'
    clonedNode.attribs = {}
    clonedNode.children = []
    return clonedNode
  }

  const templateName = resolveTemplateCall(clonedNode, wxsScopeData(scope))
  if (templateName) {
    const definition = templateRenderState.definitions.get(templateName)
    const templateScope = {
      ...scope,
      data: resolveTemplateData(clonedNode, wxsScopeData(scope)),
      wxs: definition && templateRenderState.definitionWxsScopes?.get(definition),
    }
    clonedNode.name = 'block'
    clonedNode.attribs = {
      'data-sim-node': instancePath,
      'data-sim-scope': scope.getScopeId(),
    }
    clonedNode.children = definition && !templateRenderState.stack.includes(templateName)
      ? renderChildren(
          definition.children ?? [],
          templateScope,
          context,
          ownerJsonPath,
          ownerFilePath,
          `${instancePath}/template-${templateName}`,
          renderPass,
          {
            definitions: templateRenderState.definitionScopes?.get(definition) ?? templateRenderState.definitions,
            definitionScopes: templateRenderState.definitionScopes,
            definitionWxsScopes: templateRenderState.definitionWxsScopes,
            wxsModules: templateScope.wxs,
            stack: [...templateRenderState.stack, templateName],
          },
          clonedNode,
        )
      : []
    return clonedNode
  }

  if (clonedNode.name === 'slot') {
    const slotName = clonedNode.attribs?.name?.trim() || 'default'
    const projected = scope.slots?.get(slotName) ?? []
    const fallbackChildren = clonedNode.children ?? []
    bindComponentEventHost(clonedNode)
    clonedNode.name = 'block'
    clonedNode.attribs = {
      'data-sim-node': instancePath,
      'data-sim-scope': scope.getScopeId(),
    }
    const slotOwner = scope.getScopeId()
    if (projected.length && slotOwner && isComponentConstructing(context.componentCache.get(slotOwner))) {
      clonedNode.children = []
      return clonedNode
    }
    clonedNode.children = projected.length
      ? selectConditionalChildren(
          projected.map(entry => entry.node),
          (node, index) => evaluateConditionalBranch(node, projected[index]!.scope),
        ).flatMap(({ index }) => {
          const entry = projected[index]!
          const nodes = renderNodeVariants(
            entry.node,
            entry.scope,
            context,
            entry.ownerJsonPath,
            entry.ownerFilePath,
            entry.instancePath,
            renderPass,
            entry.templateRenderState,
            clonedNode,
          )
          renderPass.renderedSlots.set(entry, nodes)
          return nodes
        })
      : renderChildren(
          fallbackChildren,
          scope,
          context,
          ownerJsonPath,
          ownerFilePath,
          `${instancePath}/slot-fallback-${slotName}`,
          renderPass,
          templateRenderState,
          clonedNode,
        )
    return clonedNode
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

    const genericComponents = resolveComponentGenerics(
      context,
      clonedNode,
      ownerJsonPath,
      ownerFilePath,
      componentEntry.filePath,
      scope.genericComponents,
    )
    const slots = collectComponentSlots(
      clonedNode,
      scope,
      ownerJsonPath,
      ownerFilePath,
      componentScopeId,
      templateRenderState,
    )
    registerSlotDeclarations(renderPass, slots, clonedNode, componentScopeId)
    applyNodeBindings(clonedNode, scope)

    const reconcilePrivateTemplate = (instance: HeadlessComponentInstance, phase: 'defaults' | 'properties') => {
      // 私有模板必须在 created/属性 observer 前完成；外层失效不能跳过本实例的后代属性交付。
      let bindingPass: RenderPass
      do {
        const bindingScope = createComponentScope(clonedNode, scope, componentScopeId, instance, genericComponents, slots)
        context.componentScopes.set(componentScopeId, bindingScope)
        bindingPass = createRenderPass(phase === 'properties', renderPass)
        renderRuntimeComponentTemplate(context, componentEntry, renderNodeTree, bindingScope, componentScopeId, bindingPass)
        reconcileSlotDeclarations(context, bindingPass)
      } while (isRenderPassStale(bindingPass))
    }

    let componentInstance = context.componentCache.get(componentScopeId)
    if (!componentInstance) {
      componentInstance = createRuntimeComponentInstance(
        componentScopeId,
        context,
        componentEntry,
        nextProperties,
        ownerScopeId,
        reconcilePrivateTemplate,
        renderPass.propertyUpdate,
      )
    }
    else {
      context.componentScopes.set(componentScopeId, createComponentScope(
        clonedNode,
        scope,
        componentScopeId,
        componentInstance,
        genericComponents,
        slots,
      ))
      syncComponentProperties(
        componentInstance,
        componentInstance.__definition__ ?? componentEntry.definition,
        nextProperties,
        bindingExpressions,
        context.changedPageKeys,
        reconcilePrivateTemplate,
      )
    }
    if (isRenderPassStale(renderPass)) {
      return clonedNode
    }

    renderPass.seenComponentScopes.add(componentScopeId)

    const componentScope = createComponentScope(
      clonedNode,
      scope,
      componentScopeId,
      componentInstance,
      genericComponents,
      slots,
    )
    context.componentScopes.set(componentScopeId, componentScope)

    const renderedComponentRoot = renderRuntimeComponentTemplate(
      context,
      componentEntry,
      renderNodeTree,
      componentScope,
      componentScopeId,
      renderPass,
    )
    mergeComponentEventRoot(renderedComponentRoot, clonedNode)
    if (renderedComponentRoot.attribs) {
      renderedComponentRoot.attribs = { ...clonedNode.attribs, ...renderedComponentRoot.attribs }
      if (clonedNode.dataset || renderedComponentRoot.dataset) {
        renderedComponentRoot.dataset = { ...clonedNode.dataset, ...renderedComponentRoot.dataset }
      }
      renderedComponentRoot.attribs['data-sim-component'] = clonedNode.name
      renderedComponentRoot.attribs['data-sim-node'] = instancePath
      renderedComponentRoot.attribs['data-sim-scope'] = componentScopeId
    }
    renderPass.componentRoots.set(componentScopeId, renderedComponentRoot)
    return renderedComponentRoot
  }

  applyNodeBindings(clonedNode, scope)
  clonedNode.attribs!['data-sim-node'] = instancePath
  clonedNode.children = renderChildren(
    clonedNode.children ?? [],
    scope,
    context,
    ownerJsonPath,
    ownerFilePath,
    `${instancePath}/${clonedNode.name}`,
    renderPass,
    templateRenderState,
    clonedNode,
  )
  return clonedNode
}

function reconcileRuntimePageTree(
  context: RuntimeRendererContext,
  page: HeadlessPageInstance,
  bindingsOnly = false,
): { root: DomNodeLike, roots: DomNodeLike[] } {
  // 挂载批次可多次刷新；迭代重启，避免兄弟数量变成调用栈深度。
  for (;;) {
    bindAttachmentBindingScope(context, page)
    if (page.__lastChangedKeys__) {
      context.changedPageKeys = page.__lastChangedKeys__
    }
    const route = page.route.replace(LEADING_SLASH_RE, '')
    const routeRecord = context.project.routes.find(item => item.route === route)
    const resourcePath = routeRecord?.resourcePath ?? route
    const templatePath = path.resolve(context.project.miniprogramRootPath, `${resourcePath}.wxml`)
    const templateSource = readTemplateSource(context.artifactSource, templatePath)
    const document = parseTemplateDocument(templateSource)
    const pageScopeId = `page:${route}`
    const pageScope: RuntimeRenderScope = {
      data: page.data,
      getMethod: (methodName: string) => {
        const method = page[methodName]
        return typeof method === 'function' ? method.bind(page) : undefined
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
    const renderPass = createPageRenderPass(page, context.componentCache)
    const root = (document.children ?? [])[0] ?? document
    const templateRenderState = prepareTemplateRenderState(context.artifactSource, root, templatePath, context.project.miniprogramRootPath, getRuntimeWxsLoader(context.moduleLoader, context.artifactSource))
    const renderedRoot = renderNodeTree(
      root,
      pageScope,
      context,
      path.resolve(context.project.miniprogramRootPath, `${resourcePath}.json`),
      `${resourcePath}.js`,
      pageScopeId,
      renderPass,
      templateRenderState,
    )

    const roots = [renderedRoot]
    if (hasCustomTabBar(context.project.appConfig, route)) {
      roots.push(renderNodeTree(
        { type: 'tag', name: 'custom-tab-bar', attribs: {}, children: [] },
        customTabBarHostScope(),
        context,
        path.resolve(context.project.miniprogramRootPath, 'app.json'),
        'app.js',
        pageScopeId,
        renderPass,
        templateRenderState,
      ))
    }
    reconcileSlotDeclarations(context, renderPass)
    if (isRenderPassStale(renderPass)) {
      continue
    }
    markPageTreeConstructed(page, context.componentCache)
    const treeRoot: DomNodeLike = roots.length > 1 ? { type: 'root', children: roots } : renderedRoot
    linkRenderedParents(treeRoot)
    registerInspectionTrees(treeRoot, renderPass, context.componentScopes)
    if (bindingsOnly) {
      return { root: treeRoot, roots }
    }
    let bindingsRefreshed = false
    const updateBindings = () => {
      bindingsRefreshed = true
      if (hasPendingComponentConstruction(context.componentCache)) {
        return
      }
      reconcileRuntimePageTree(context, page, true)
    }

    // Component 页面先创建子树，再执行页面 created/attached，最后统一挂载后代。
    const pageAttached = attachComponentPage(page, updateBindings)
    if (bindingsRefreshed) {
      continue
    }
    const pageAttaching = isComponentPageAttaching(page)
    const scopeIds = orderComponentAttachmentScopes(renderPass.seenComponentScopes, context.componentScopes)
    const instances = scopeIds.map(scopeId => context.componentCache.get(scopeId)!)
    const attached = !pageAttaching && runWithAttachmentBindingUpdates(
      page,
      updateBindings,
      scopes => flushComponentAttachments(context.componentCache, scopes, (instance) => {
        runComponentLifecycle(instance, 'attached')
        return bindingsRefreshed
      }),
      scopeIds,
    )
    if (attached === 'restart') {
      continue
    }
    const canFinalize = !pageAttaching && !hasPendingComponentAttachments(instances)
    // 挂载回调返回后才派发 detached；此时仍可读取旧关系，随后再解除双方关系。
    const removed = canFinalize
      ? [...context.componentCache].filter(([scopeId]) => scopeId.startsWith(`${pageScopeId}/`) && !renderPass.seenComponentScopes.has(scopeId))
      : []
    for (const [scopeId, instance] of removed) {
      if (isComponentAttached(instance)) {
        runComponentLifecycle(instance, 'detached')
      }
      else {
        scheduleDiscardedComponentReady(context.componentCache, scopeId, instance)
      }
    }
    const relationsChanged = canFinalize && syncComponentRelations(context.componentCache, renderPass.seenComponentScopes, pageScopeId)
    for (const [scopeId] of removed) {
      context.componentCache.delete(scopeId)
      context.componentScopes.delete(scopeId)
    }

    if (pageAttached || attached || relationsChanged) {
      continue
    }

    if (canFinalize && !isPageBeforeReady(page)) {
      flushDiscardedComponentReady(context.componentCache, pageScopeId, instance => runComponentLifecycle(instance, 'ready'))
    }

    if (canFinalize && !isPageBeforeReady(page) && flushComponentReady(instances, (instance) => {
      runComponentLifecycle(instance, 'ready')
      if (instance !== context.componentCache.get(customTabBarScopeId(route))) {
        instance.__definition__?.pageLifetimes?.show?.call(instance)
      }
    })) {
      continue
    }

    return {
      root: treeRoot,
      roots,
    }
  }
}

export function renderRuntimePageTree(
  context: RuntimeRendererContext,
  page: HeadlessPageInstance,
): RuntimeRenderedPageTree {
  const { root, roots } = reconcileRuntimePageTree(context, page)
  return {
    root,
    wxml: roots.map(serializeDomNode).join(''),
  }
}

export type { RuntimeRenderedPageTree, RuntimeRendererContext } from './types'
