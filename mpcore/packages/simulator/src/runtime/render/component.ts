import type { HeadlessComponentDefinition } from '../../host'
import type { TemplateRenderState } from '../../view/templateRuntime'
import type { HeadlessComponentInstance } from '../componentInstance'
import type { DomNodeLike, RuntimeComponentRegistryEntry, RuntimeRendererContext, RuntimeRenderScope, RuntimeSlotContent } from './types'
import path from 'node:path'
import { resolvePluginRequest } from '../../project/plugins'
import { collectMiniProgramEventBindings } from '../../view/eventBinding'
import { setSelectorQueryScopeId } from '../../view/selectorQueryScope'
import { createTemplateRenderState } from '../../view/templateRuntime'
import {
  cloneValue,
  createComponentInstance,
  hasComponentPropertyValueChanged,
  normalizeComponentPropertyValue,
  runComponentLifecycle,
  runComponentObservers,
} from '../componentInstance'
import {
  CLASS_SPLIT_RE,
  collectDataset,
  createMergedScopeData,
  isMustacheOnly,
  JS_FILE_RE,
  LEADING_SLASH_RE,
  parseTemplateDocument,
  readTemplateSource,
  resolveComponentAttributeValue,
} from './shared'

export function resolveComponentRegistryEntry(
  context: RuntimeRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
  alias: string,
  genericComponentBasePath?: string,
) {
  // eslint-disable-next-line ts/no-use-before-define
  const usingComponents = resolveUsingComponents(context, ownerJsonPath, ownerFilePath)
  const componentBasePath = genericComponentBasePath ?? usingComponents.get(alias)
  if (!componentBasePath) {
    return null
  }

  const filePath = `${componentBasePath}.js`
  const templatePath = `${componentBasePath}.wxml`
  const absoluteFilePath = path.resolve(context.project.miniprogramRootPath, filePath)
  const absoluteTemplatePath = path.resolve(context.project.miniprogramRootPath, templatePath)
  const definition = context.moduleLoader.executeComponentModule(absoluteFilePath, componentBasePath)
  return {
    definition,
    filePath,
    templatePath,
    absoluteTemplatePath,
  } satisfies RuntimeComponentRegistryEntry & { absoluteTemplatePath: string }
}

function readComponentConfig(artifactSource: RuntimeRendererContext['artifactSource'], jsonPath: string) {
  try {
    const source = artifactSource.readText(jsonPath)
    return source ? JSON.parse(source) as Record<string, any> : {}
  }
  catch {
    return {}
  }
}

function resolveUsingComponents(
  context: RuntimeRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
) {
  try {
    const parsed = readComponentConfig(context.artifactSource, ownerJsonPath)
    const usingComponents = parsed.usingComponents
    if (!usingComponents || typeof usingComponents !== 'object' || Array.isArray(usingComponents)) {
      return new Map<string, string>()
    }

    const resolved = new Map<string, string>()
    for (const [alias, rawPath] of Object.entries(usingComponents)) {
      if (typeof rawPath !== 'string') {
        continue
      }
      const pluginRequest = resolvePluginRequest(context.project.plugins, rawPath, 'publicComponent')
      const basePath = pluginRequest?.resourcePath ?? (rawPath.startsWith('/')
        ? rawPath.replace(LEADING_SLASH_RE, '')
        : path.posix.normalize(path.posix.join(path.posix.dirname(ownerFilePath), rawPath)))
      resolved.set(alias, basePath.replace(LEADING_SLASH_RE, ''))
    }
    return resolved
  }
  catch {
    return new Map<string, string>()
  }
}

export function resolveComponentGenerics(
  context: RuntimeRendererContext,
  hostNode: DomNodeLike,
  ownerJsonPath: string,
  ownerFilePath: string,
  componentFilePath: string,
) {
  const componentJsonPath = path.resolve(
    context.project.miniprogramRootPath,
    `${componentFilePath.replace(JS_FILE_RE, '')}.json`,
  )
  const componentGenerics = readComponentConfig(context.artifactSource, componentJsonPath).componentGenerics
  if (!componentGenerics || typeof componentGenerics !== 'object' || Array.isArray(componentGenerics)) {
    return undefined
  }

  const ownerComponents = resolveUsingComponents(context, ownerJsonPath, ownerFilePath)
  const resolved = new Map<string, string>()
  for (const [genericName, definition] of Object.entries(componentGenerics)) {
    const selectedAlias = hostNode.attribs?.[`generic:${genericName}`]
    const selectedPath = selectedAlias ? ownerComponents.get(selectedAlias) : undefined
    if (selectedPath) {
      resolved.set(genericName, selectedPath)
      continue
    }

    const defaultPath = typeof definition === 'object' && definition !== null
      ? (definition as Record<string, any>).default
      : undefined
    if (typeof defaultPath !== 'string' || !defaultPath) {
      continue
    }
    const resolvedDefault = defaultPath.startsWith('/')
      ? defaultPath.replace(LEADING_SLASH_RE, '')
      : path.posix.normalize(path.posix.join(path.posix.dirname(componentFilePath), defaultPath))
    resolved.set(genericName, resolvedDefault.replace(LEADING_SLASH_RE, ''))
  }
  return resolved.size > 0 ? resolved : undefined
}

export function collectComponentEventBindings(hostNode: DomNodeLike) {
  return collectMiniProgramEventBindings(hostNode.attribs)
}

export function buildComponentTrigger(
  componentScopeId: string,
  context: RuntimeRendererContext,
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
    const componentDataset = context.componentScopes.get(componentScopeId)?.dataset ?? hostDataset
    const interactionMark = instance.__lastInteractionEvent__?.mark
    const target = {
      dataset: interactionTarget?.dataset ?? componentDataset,
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
          currentTarget: {
            dataset: currentScope?.dataset ?? interactionCurrentTarget?.dataset ?? hostDataset,
            id: currentScope?.hostId ?? interactionCurrentTarget?.id ?? hostId,
          },
          detail,
          mark: interactionMark,
          target,
          type: eventName,
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

export function syncComponentProperties(
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
    if (hasComponentPropertyValueChanged(instance.properties[key], previousSnapshot, nextValue, bindingAffected)) {
      previousProperties[key] = instance.properties[key]
      instance.properties[key] = nextValue
      instance.data[key] = nextValue
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

export function createComponentScope(
  clonedNode: DomNodeLike,
  scope: RuntimeRenderScope,
  componentScopeId: string,
  componentInstance: HeadlessComponentInstance,
  genericComponents?: Map<string, string>,
  slots?: Map<string, RuntimeSlotContent[]>,
): RuntimeRenderScope {
  const ownerScopeId = scope.getScopeId().includes('/') ? scope.getScopeId() : undefined
  return {
    alias: clonedNode.name,
    classList: String(clonedNode.attribs?.class ?? '')
      .split(CLASS_SPLIT_RE)
      .map(item => item.trim())
      .filter(Boolean),
    data: createMergedScopeData(scope.data, componentInstance.properties, componentInstance.data),
    dataset: collectDataset(clonedNode, scope.data),
    eventBindings: collectComponentEventBindings(clonedNode),
    getMethod: (methodName: string) => {
      const method = componentInstance?.[methodName]
      return typeof method === 'function' ? method : undefined
    },
    getScopeId: () => componentScopeId,
    genericComponents,
    hostId: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
    id: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
    listenerScopeId: scope.getScopeId(),
    ownerScopeId,
    slots,
  }
}

export function resolveComponentProperties(
  clonedNode: DomNodeLike,
  scope: RuntimeRenderScope,
  definition: HeadlessComponentDefinition,
) {
  const nextProperties: Record<string, any> = {}
  const bindingExpressions: Record<string, string | undefined> = {}
  const declaredProperties = definition.properties ?? {}
  for (const [key, value] of Object.entries(clonedNode.attribs ?? {})) {
    if (key.startsWith('bind') || key.startsWith('generic:')) {
      continue
    }
    const camelizedKey = key.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase())
    const propertyKey = key in declaredProperties || !(camelizedKey in declaredProperties)
      ? key
      : camelizedKey
    if (isMustacheOnly(String(value))) {
      bindingExpressions[propertyKey] = String(value).trim().slice(2, -2).trim()
    }
    nextProperties[propertyKey] = resolveComponentAttributeValue(String(value), scope)
  }
  return { nextProperties, bindingExpressions }
}

export function createRuntimeComponentInstance(
  componentScopeId: string,
  context: RuntimeRendererContext,
  clonedNode: DomNodeLike,
  componentEntry: NonNullable<ReturnType<typeof resolveComponentRegistryEntry>>,
  nextProperties: Record<string, any>,
  ownerScopeId: string | undefined,
) {
  const isWevuNativeDefinition = Object.keys(componentEntry.definition.methods ?? {}).some(key => key.startsWith('__weapp_vite_'))
    || Object.hasOwn(componentEntry.definition.properties ?? {}, '__wvSlotOwnerId')
  const componentProperties = isWevuNativeDefinition
    ? Object.fromEntries(Object.keys(componentEntry.definition.properties ?? {})
        .filter(key => Object.hasOwn(nextProperties, key))
        .map(key => [key, nextProperties[key]]))
    : nextProperties
  const componentInstance = createComponentInstance({
    definition: componentEntry.definition,
    properties: componentProperties,
    requestRender: callback => context.session.requestRender(callback),
    triggerEvent: buildComponentTrigger(componentScopeId, context, clonedNode),
  })
  setSelectorQueryScopeId(componentInstance, componentScopeId)
  componentInstance.is = componentEntry.filePath.replace(JS_FILE_RE, '')
  componentInstance.createIntersectionObserver = (options?: Record<string, any>) => context.session.createIntersectionObserver(componentInstance, options)
  componentInstance.createMediaQueryObserver = () => context.session.createMediaQueryObserver(componentInstance)
  componentInstance.selectComponent = (selector: string) => context.session.selectComponentWithin(componentScopeId, selector)
  componentInstance.selectAllComponents = (selector: string) => context.session.selectAllComponentsWithin(componentScopeId, selector)
  componentInstance.selectOwnerComponent = () => ownerScopeId
    ? context.componentCache.get(ownerScopeId) ?? null
    : null
  context.componentCache.set(componentScopeId, componentInstance)
  runComponentLifecycle(componentInstance, 'created')
  runComponentObservers(componentInstance.__definition__ ?? componentEntry.definition, componentInstance, Object.keys(componentProperties), {})
  componentInstance.__propertySnapshots = Object.fromEntries(
    Object.entries(componentInstance.properties).map(([key, propertyValue]) => [key, cloneValue(propertyValue)]),
  )
  runComponentLifecycle(componentInstance, 'attached')
  return componentInstance
}

export function renderRuntimeComponentTemplate(
  context: RuntimeRendererContext,
  componentEntry: NonNullable<ReturnType<typeof resolveComponentRegistryEntry>>,
  renderNodeTree: (
    node: DomNodeLike,
    scope: RuntimeRenderScope,
    context: RuntimeRendererContext,
    ownerJsonPath: string,
    ownerFilePath: string,
    instancePath: string,
    seenComponentScopes: Set<string>,
    templateRenderState: TemplateRenderState<DomNodeLike>,
  ) => DomNodeLike,
  componentScope: RuntimeRenderScope,
  componentScopeId: string,
  seenComponentScopes: Set<string>,
) {
  const componentTemplate = readTemplateSource(context.artifactSource, componentEntry.absoluteTemplatePath)
  const componentDocument = parseTemplateDocument(componentTemplate)
  const componentRoot = (componentDocument.children ?? [])[0] ?? componentDocument
  const templateRenderState = createTemplateRenderState(componentRoot)
  return renderNodeTree(
    componentRoot,
    componentScope,
    context,
    path.resolve(context.project.miniprogramRootPath, `${componentEntry.filePath.replace(JS_FILE_RE, '')}.json`),
    componentEntry.filePath,
    componentScopeId,
    seenComponentScopes,
    templateRenderState,
  )
}
