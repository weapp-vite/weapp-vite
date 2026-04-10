import type { HeadlessComponentDefinition } from '../../host'
import type { HeadlessComponentInstance } from '../componentInstance'
import type { DomNodeLike, RuntimeComponentRegistryEntry, RuntimeRendererContext, RuntimeRenderScope } from './types'
import fs from 'node:fs'
import path from 'node:path'
import {
  cloneValue,
  createComponentInstance,
  normalizeComponentPropertyValue,
  runComponentLifecycle,
  runComponentObservers,
} from '../componentInstance'
import {
  CLASS_SPLIT_RE,
  collectDataset,
  COMPONENT_EVENT_PREFIXES,
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
) {
  // eslint-disable-next-line ts/no-use-before-define
  const usingComponents = resolveUsingComponents(ownerJsonPath, ownerFilePath)
  const componentBasePath = usingComponents.get(alias)
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

function resolveUsingComponents(
  ownerJsonPath: string,
  ownerFilePath: string,
) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ownerJsonPath, 'utf8')) as Record<string, any>
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
        : path.posix.normalize(path.posix.join(path.posix.dirname(ownerFilePath), rawPath))
      resolved.set(alias, basePath.replace(LEADING_SLASH_RE, ''))
    }
    return resolved
  }
  catch {
    return new Map<string, string>()
  }
}

export function collectComponentEventBindings(hostNode: DomNodeLike) {
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

export function createComponentScope(
  clonedNode: DomNodeLike,
  scope: RuntimeRenderScope,
  componentScopeId: string,
  componentInstance: HeadlessComponentInstance,
): RuntimeRenderScope {
  const ownerScopeId = scope.getScopeId().includes('/') ? scope.getScopeId() : undefined
  return {
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
}

export function resolveComponentProperties(
  clonedNode: DomNodeLike,
  scope: RuntimeRenderScope,
) {
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
  const componentInstance = createComponentInstance({
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
  context.componentCache.set(componentScopeId, componentInstance)
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
  ) => DomNodeLike,
  componentScope: RuntimeRenderScope,
  componentScopeId: string,
  seenComponentScopes: Set<string>,
) {
  const componentTemplate = readTemplateSource(componentEntry.absoluteTemplatePath)
  const componentDocument = parseTemplateDocument(componentTemplate)
  const componentRoot = (componentDocument.children ?? [])[0] ?? componentDocument
  return renderNodeTree(
    componentRoot,
    componentScope,
    context,
    path.resolve(context.project.miniprogramRootPath, `${componentEntry.filePath.replace(JS_FILE_RE, '')}.json`),
    componentEntry.filePath,
    componentScopeId,
    seenComponentScopes,
  )
}
