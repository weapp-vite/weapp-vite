import type { HeadlessComponentDefinition } from '../../host'
import type { CreateComponentInstanceOptions, HeadlessComponentInstance } from '../../runtime/componentInstance'
import type { RenderPass } from '../../view/renderPass'
import type { TemplateRenderState } from '../../view/templateRuntime'
import type { BrowserVirtualFiles } from '../virtualFiles'
import type { BrowserComponentRegistryEntry, BrowserRendererContext, BrowserRenderScope, BrowserSlotContent, DomNodeLike } from './types'
import { dirname, join, normalize } from 'pathe'
import { resolvePluginRequest } from '../../project/plugins'
import {
  cloneValue,
  createComponentInstance,
  hasComponentPropertyValueChanged,
  normalizeComponentPropertyValue,
  runComponentLifecycle,
  runComponentObservers,
} from '../../runtime/componentInstance'
import { beginComponentConstruction, discardComponentConstruction, finishComponentConstruction } from '../../runtime/componentInstance/construction'
import { resolveNativeComponentSelection } from '../../runtime/componentInstance/selection'
import { resolveMiniProgramComponent } from '../../runtime/componentResolution'
import { bindComponentEventHost, buildComponentTrigger } from '../../view/componentEvent'
import { setSelectorQueryScopeId } from '../../view/selectorQueryScope'
import { wxsScopeData } from '../../view/wxs'
import { readBrowserVirtualFile } from '../virtualFiles'
import { getBrowserWxsLoader } from '../wxs'
import {
  CLASS_SPLIT_RE,
  collectDataset,
  isMustacheOnly,
  JS_FILE_RE,
  LEADING_SLASH_RE,
  parseTemplateDocument,
  prepareTemplateRenderState,
  readTemplateSource,
  resolveComponentAttributeValue,
} from './shared'

export function resolveComponentRegistryEntry(
  context: BrowserRendererContext,
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
  const definition = context.moduleLoader.executeComponentModule(join(context.project.miniprogramRootPath, filePath), componentBasePath)
  return {
    definition,
    filePath,
    templatePath,
  } satisfies BrowserComponentRegistryEntry
}

function readComponentConfig(files: BrowserVirtualFiles, jsonPath: string) {
  const source = readBrowserVirtualFile(files, jsonPath)
  if (typeof source !== 'string') {
    return {}
  }
  try {
    return JSON.parse(source) as Record<string, any>
  }
  catch {
    return {}
  }
}

function resolveUsingComponents(
  context: BrowserRendererContext,
  ownerJsonPath: string,
  ownerFilePath: string,
) {
  try {
    const parsed = readComponentConfig(context.files, join(context.project.miniprogramRootPath, ownerJsonPath))
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
      const basePath = pluginRequest?.resourcePath ?? resolveMiniProgramComponent(
        ownerFilePath,
        rawPath,
        context.project.miniprogramRootPath,
        candidate => readBrowserVirtualFile(context.files, candidate) !== undefined,
      )
      resolved.set(alias, basePath.replace(LEADING_SLASH_RE, ''))
    }
    return resolved
  }
  catch {
    return new Map<string, string>()
  }
}

export function resolveComponentGenerics(
  context: BrowserRendererContext,
  hostNode: DomNodeLike,
  ownerJsonPath: string,
  ownerFilePath: string,
  componentFilePath: string,
  ownerGenerics?: Map<string, string>,
) {
  const componentJsonPath = join(context.project.miniprogramRootPath, `${componentFilePath.replace(JS_FILE_RE, '')}.json`)
  const componentGenerics = readComponentConfig(context.files, componentJsonPath).componentGenerics
  if (!componentGenerics || typeof componentGenerics !== 'object' || Array.isArray(componentGenerics)) {
    return undefined
  }

  const ownerComponents = resolveUsingComponents(context, ownerJsonPath, ownerFilePath)
  const resolved = new Map<string, string>()
  for (const [genericName, definition] of Object.entries(componentGenerics)) {
    const selectedAlias = hostNode.attribs?.[`generic:${genericName}`]
    const selectedPath = selectedAlias ? ownerGenerics?.get(selectedAlias) ?? ownerComponents.get(selectedAlias) : undefined
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
      : normalize(join(dirname(componentFilePath), defaultPath))
    resolved.set(genericName, resolvedDefault.replace(LEADING_SLASH_RE, ''))
  }
  return resolved.size > 0 ? resolved : undefined
}

export function syncComponentProperties(
  instance: HeadlessComponentInstance,
  definition: HeadlessComponentDefinition,
  nextProperties: Record<string, any>,
  bindingExpressions: Record<string, string | undefined>,
  changedPageKeys: string[],
  beforeObservers?: (instance: HeadlessComponentInstance, phase: 'properties') => void,
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
      // 属性跨组件边界传递时必须隔离引用，否则父级深层 patch 会提前改写子级旧值。
      const deliveredValue = cloneValue(nextValue)
      instance.properties[key] = deliveredValue
      if (Object.hasOwn(definition.properties ?? {}, key)) {
        instance.data[key] = deliveredValue
      }
      changedRootKeys.push(key)
    }
    instance.__propertySnapshots ??= {}
    instance.__propertySnapshots[key] = cloneValue(nextValue)
  }

  if (changedRootKeys.length === 0) {
    return
  }

  beforeObservers?.(instance, 'properties')
  runComponentObservers(definition, instance, changedRootKeys, previousProperties)
}

export function createComponentScope(
  clonedNode: DomNodeLike,
  scope: BrowserRenderScope,
  componentScopeId: string,
  componentInstance: HeadlessComponentInstance,
  genericComponents?: Map<string, string>,
  slots?: Map<string, BrowserSlotContent[]>,
): BrowserRenderScope {
  const ownerScopeId = scope.getScopeId().includes('/') ? scope.getScopeId() : undefined
  return {
    alias: clonedNode.name,
    classList: String(clonedNode.attribs?.class ?? '')
      .split(CLASS_SPLIT_RE)
      .map(item => item.trim())
      .filter(Boolean),
    data: { ...componentInstance.data },
    dataset: collectDataset(clonedNode, wxsScopeData(scope)),
    ...bindComponentEventHost(clonedNode),
    getMethod: (methodName: string) => {
      const method = componentInstance?.[methodName]
      return typeof method === 'function' ? method.bind(componentInstance) : undefined
    },
    getScopeId: () => componentScopeId,
    genericComponents,
    hostId: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
    hostNode: clonedNode,
    id: typeof clonedNode.attribs?.id === 'string' ? clonedNode.attribs.id : undefined,
    listenerScopeId: scope.getScopeId(),
    ownerScopeId,
    slots,
  }
}

export function resolveComponentProperties(
  clonedNode: DomNodeLike,
  scope: BrowserRenderScope,
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

export function createBrowserComponentInstance(
  componentScopeId: string,
  context: BrowserRendererContext,
  componentEntry: NonNullable<ReturnType<typeof resolveComponentRegistryEntry>>,
  nextProperties: Record<string, any>,
  ownerScopeId: string | undefined,
  renderTemplate?: (instance: HeadlessComponentInstance, phase: 'defaults' | 'properties') => void,
  bindEventsBeforeProperties = false,
) {
  const isWevuNativeDefinition = Object.keys(componentEntry.definition.methods ?? {}).some(key => key.startsWith('__weapp_vite_'))
    || Object.hasOwn(componentEntry.definition.properties ?? {}, '__wvSlotOwnerId')
  const componentProperties = isWevuNativeDefinition
    ? Object.fromEntries(Object.keys(componentEntry.definition.properties ?? {})
        .filter(key => Object.hasOwn(nextProperties, key))
        .map(key => [key, nextProperties[key]]))
    : nextProperties
  const instanceOptions: CreateComponentInstanceOptions = {
    definition: componentEntry.definition,
    requestRender: callback => context.session.requestRender(callback),
  }
  const componentInstance = createComponentInstance(instanceOptions)
  setSelectorQueryScopeId(componentInstance, componentScopeId)
  componentInstance.is = componentEntry.filePath.replace(JS_FILE_RE, '')
  componentInstance.createIntersectionObserver = (options?: Record<string, any>) => context.session.createIntersectionObserver(componentInstance, options)
  componentInstance.createMediaQueryObserver = () => context.session.createMediaQueryObserver(componentInstance)
  componentInstance.createSelectorQuery = () => context.moduleLoader.wx.createSelectorQuery().in(componentInstance)
  componentInstance.selectComponent = (selector: string) => resolveNativeComponentSelection(context.session.selectComponentWithin(componentScopeId, selector))
  componentInstance.selectAllComponents = (selector: string) => context.session.selectAllComponentsWithin(componentScopeId, selector).map(resolveNativeComponentSelection)
  componentInstance.selectOwnerComponent = () => ownerScopeId
    ? resolveNativeComponentSelection(context.componentCache.get(ownerScopeId))
    : null
  beginComponentConstruction(context.componentCache, componentScopeId, componentInstance)
  context.componentCache.set(componentScopeId, componentInstance)
  try {
    renderTemplate?.(componentInstance, 'defaults')
    runComponentLifecycle(componentInstance, 'created')
    // created 尚未连接声明事件；属性更新中新建的节点先连接，再派发初始属性 observer。
    if (bindEventsBeforeProperties) {
      instanceOptions.triggerEvent = buildComponentTrigger(componentScopeId, context)
    }
    componentInstance.__propertySnapshots = Object.fromEntries(
      Object.entries(componentInstance.properties).map(([key, propertyValue]) => [key, cloneValue(propertyValue)]),
    )
    syncComponentProperties(componentInstance, componentInstance.__definition__ ?? componentEntry.definition, componentProperties, {}, [], renderTemplate)
    if (!bindEventsBeforeProperties) {
      instanceOptions.triggerEvent = buildComponentTrigger(componentScopeId, context)
    }
    return componentInstance
  }
  catch (error) {
    discardComponentConstruction(context.componentCache, context.componentScopes, componentScopeId)
    throw error
  }
  finally {
    finishComponentConstruction(context.componentCache, componentInstance)
  }
}

export function renderBrowserComponentTemplate(
  context: BrowserRendererContext,
  componentEntry: NonNullable<ReturnType<typeof resolveComponentRegistryEntry>>,
  renderNodeTree: (
    node: DomNodeLike,
    scope: BrowserRenderScope,
    context: BrowserRendererContext,
    ownerJsonPath: string,
    ownerFilePath: string,
    instancePath: string,
    renderPass: RenderPass,
    templateRenderState: TemplateRenderState<DomNodeLike>,
    parent?: DomNodeLike,
  ) => DomNodeLike,
  componentScope: BrowserRenderScope,
  componentScopeId: string,
  renderPass: RenderPass,
) {
  const templatePath = join(context.project.miniprogramRootPath, componentEntry.templatePath)
  const componentTemplate = readTemplateSource(context.files, templatePath)
  const componentDocument = parseTemplateDocument(componentTemplate)
  const componentRoot = (componentDocument.children ?? [])[0] ?? componentDocument
  const templateRenderState = prepareTemplateRenderState(context.files, componentRoot, templatePath, context.project.miniprogramRootPath, getBrowserWxsLoader(context.moduleLoader, context.files))
  return renderNodeTree(
    componentRoot,
    componentScope,
    context,
    `${componentEntry.filePath.replace(JS_FILE_RE, '')}.json`,
    componentEntry.filePath,
    componentScopeId,
    renderPass,
    templateRenderState,
    componentScope.hostNode,
  )
}
