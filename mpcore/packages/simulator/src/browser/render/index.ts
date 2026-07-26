import type { HeadlessPageInstance } from '../../runtime/pageInstance'
import type { BrowserRenderedPageTree, BrowserRendererContext, BrowserRenderScope, BrowserSlotContent, DomNodeLike } from './types'
import { join } from 'pathe'
import { runComponentLifecycle } from '../../runtime/componentInstance'
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
  isIgnorableTextNode,
  isTagNode,
  LEADING_SLASH_RE,
  parseTemplateDocument,
  readTemplateSource,
  resolveRawValueByPath,
  serializeDomNode,
  WX_ELSE_ATTRS,
} from './shared'

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
      renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, seenComponentScopes))
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
          renderedChildren.push(...renderNodeVariants(branch, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${cursor}`, seenComponentScopes))
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

    renderedChildren.push(...renderNodeVariants(child, scope, context, ownerJsonPath, ownerFilePath, `${instancePath}/node-${index}`, seenComponentScopes))
  }

  return renderedChildren
}

function collectComponentSlots(
  componentNode: DomNodeLike,
  scope: BrowserRenderScope,
  ownerJsonPath: string,
  ownerFilePath: string,
  instancePath: string,
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
): DomNodeLike {
  const clonedNode = cloneNode(node)
  if (!isTagNode(clonedNode)) {
    applyNodeBindings(clonedNode, scope)
    return clonedNode
  }

  if (clonedNode.name === 'slot') {
    const slotName = clonedNode.attribs?.name?.trim() || 'default'
    const projected = scope.slots?.get(slotName) ?? []
    const children = projected.length
      ? projected.flatMap(entry => renderNodeVariants(
          entry.node,
          entry.scope,
          context,
          entry.ownerJsonPath,
          entry.ownerFilePath,
          entry.instancePath,
          seenComponentScopes,
        ))
      : renderChildren(
          clonedNode.children ?? [],
          scope,
          context,
          ownerJsonPath,
          ownerFilePath,
          `${instancePath}/slot-fallback-${slotName}`,
          seenComponentScopes,
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
      renderedComponentRoot.attribs['data-sim-component'] = clonedNode.name
      renderedComponentRoot.attribs['data-sim-scope'] = componentScopeId
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

export type { BrowserRenderedPageTree, BrowserRendererContext } from './types'
