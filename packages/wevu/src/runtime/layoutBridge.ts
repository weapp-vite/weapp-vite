import { getCurrentInstance, getCurrentSetupContext, onAttached, onDetached } from './hooks'

type LayoutBridgeContext = Record<string, any>
type LayoutBridgeComponentResolver = (selector: string) => any

const pageLayoutBridges = new Map<string, Map<string, LayoutBridgeContext>>()
const layoutBridgePageKeys = '__wevuLayoutBridgePageKeys'
const LEADING_SLASH_RE = /^\/+/

function resolveCurrentPageInstance() {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }
  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

function normalizeSelectors(selectors: string | string[]) {
  return Array.from(new Set(Array.isArray(selectors) ? selectors : [selectors]))
    .filter((selector): selector is string => typeof selector === 'string' && selector.length > 0)
}

function resolvePageKeys(page?: LayoutBridgeContext) {
  const keys: string[] = []
  if (!page || typeof page !== 'object') {
    return keys
  }

  const webviewId = page.__wxWebviewId__
  if (typeof webviewId === 'number' || typeof webviewId === 'string') {
    keys.push(`webview:${String(webviewId)}`)
  }

  const exparserNodeId = page.__wxExparserNodeId__
  if (typeof exparserNodeId === 'number' || typeof exparserNodeId === 'string') {
    keys.push(`exparser:${String(exparserNodeId)}`)
  }

  const route = typeof page.route === 'string' ? page.route.replace(LEADING_SLASH_RE, '') : ''
  if (route) {
    keys.push(`route:${route}`)
  }

  return Array.from(new Set(keys))
}

function resolvePageFromContext(context?: LayoutBridgeContext) {
  if (context && typeof context.__wevuSetPageLayout === 'function') {
    return context
  }
  return resolveCurrentPageInstance()
}

function resolveNativeLayoutContext(context?: LayoutBridgeContext) {
  if (!context || typeof context !== 'object') {
    return undefined
  }

  const runtimeNativeInstance = context.__wevu?.state?.__wevuNativeInstance
  if (runtimeNativeInstance && typeof runtimeNativeInstance === 'object') {
    return runtimeNativeInstance as LayoutBridgeContext
  }

  const stateNativeInstance = context.$state?.__wevuNativeInstance
  if (stateNativeInstance && typeof stateNativeInstance === 'object') {
    return stateNativeInstance as LayoutBridgeContext
  }

  if (context.__wevuNativeInstance && typeof context.__wevuNativeInstance === 'object') {
    return context.__wevuNativeInstance as LayoutBridgeContext
  }

  return context
}

/**
 * 为当前页面注册 layout bridge，使页面或子组件可消费 layout 内部能力。
 */
export function registerPageLayoutBridge(
  selectors: string | string[],
  context?: LayoutBridgeContext,
) {
  const bridgeContext = context ?? getCurrentInstance<LayoutBridgeContext>()
  const page = resolvePageFromContext(bridgeContext)
  const pageKeys = resolvePageKeys(page)
  if (!bridgeContext || !page || pageKeys.length === 0) {
    return false
  }

  for (const pageKey of pageKeys) {
    const registry = pageLayoutBridges.get(pageKey) ?? new Map<string, LayoutBridgeContext>()
    for (const selector of normalizeSelectors(selectors)) {
      registry.set(selector, bridgeContext)
    }
    pageLayoutBridges.set(pageKey, registry)
  }
  bridgeContext[layoutBridgePageKeys] = pageKeys
  return true
}

/**
 * 移除当前页面的 layout bridge 注册。
 */
export function unregisterPageLayoutBridge(
  selectors: string | string[],
  context?: LayoutBridgeContext,
) {
  const bridgeContext = context ?? getCurrentInstance<LayoutBridgeContext>()
  const page = resolvePageFromContext(bridgeContext)
  const pageKeys = bridgeContext?.[layoutBridgePageKeys] ?? resolvePageKeys(page)
  if (!bridgeContext || !Array.isArray(pageKeys) || pageKeys.length === 0) {
    return false
  }

  let removed = false
  for (const pageKey of pageKeys) {
    const registry = pageLayoutBridges.get(pageKey)
    if (!registry) {
      continue
    }

    for (const selector of normalizeSelectors(selectors)) {
      if (registry.get(selector) === bridgeContext) {
        registry.delete(selector)
        removed = true
      }
    }

    if (registry.size === 0) {
      pageLayoutBridges.delete(pageKey)
    }
  }

  delete bridgeContext[layoutBridgePageKeys]
  return removed
}

/**
 * 解析当前页面已注册的 layout bridge，找不到时回退到传入上下文。
 */
export function resolveLayoutBridge<T = any>(
  selector: string,
  fallbackContext?: T,
) {
  const page = resolveCurrentPageInstance() ?? resolvePageFromContext(fallbackContext as LayoutBridgeContext | undefined)
  const bridgeContext = resolvePageKeys(page)
    .map(pageKey => pageLayoutBridges.get(pageKey)?.get(selector))
    .find(Boolean)
  return (bridgeContext ?? fallbackContext ?? getCurrentInstance()) as T | undefined
}

/**
 * 在 layout 生命周期内暴露 bridge，使页面或子组件可访问 layout 内部实例。
 */
export function useLayoutBridge(
  selectors: string | string[],
  options: {
    resolveComponent?: LayoutBridgeComponentResolver
  } = {},
) {
  if (!getCurrentSetupContext()) {
    throw new Error('useLayoutBridge() 必须在 setup() 的同步阶段调用')
  }

  const context = getCurrentInstance<LayoutBridgeContext>()
  const normalizedSelectors = normalizeSelectors(selectors)
  const resolveComponent = options.resolveComponent
  const nativeContext = resolveNativeLayoutContext(context)
  const bridgeBase = nativeContext && typeof nativeContext === 'object'
    ? Object.create(nativeContext)
    : {}
  const bridge = Object.assign(bridgeBase, {
    selectComponent(selector: string) {
      if (!normalizedSelectors.includes(selector)) {
        return null
      }

      const resolvedComponent = resolveComponent?.(selector)
      if (resolvedComponent !== undefined) {
        return resolvedComponent
      }

      const nativeContext = resolveNativeLayoutContext(context)
      const directMatch = nativeContext?.selectComponent?.(selector)
      if (directMatch) {
        return directMatch
      }

      const currentPage = resolveCurrentPageInstance()
      return currentPage?.selectComponent?.(selector) ?? null
    },
  })

  registerPageLayoutBridge(normalizedSelectors, bridge)

  onAttached(() => {
    registerPageLayoutBridge(normalizedSelectors, bridge)
  })

  onDetached(() => {
    unregisterPageLayoutBridge(normalizedSelectors, bridge)
  })
}
