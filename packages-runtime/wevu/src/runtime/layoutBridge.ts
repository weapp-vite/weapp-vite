import type { Ref } from '../reactivity'
import { WEVU_NATIVE_INSTANCE_KEY } from '@weapp-core/constants'
import { isRef } from '../reactivity'
import { getCurrentInstance, getCurrentSetupContext, onAttached, onDetached } from './hooks'
import { getTemplateRefMap } from './templateRefs/helpers'

type LayoutBridgeContext = Record<string, any>
type LayoutBridgeComponentResolver = (selector: string) => any
type LayoutHostMap = Record<string, unknown>
export type LayoutBridgeInstance<T = LayoutBridgeContext> = T & {
  selectComponent?: LayoutBridgeComponentResolver
}
export interface LayoutHostBinding {
  key: string
  refName?: string
  selector: string
  kind?: 'component'
}
interface LayoutHostResolveOptions<T = any> {
  context?: T
  fallbackContext?: T
  interval?: number
  retries?: number
}

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

  const runtimeNativeInstance = context.__wevu?.state?.[WEVU_NATIVE_INSTANCE_KEY]
  if (runtimeNativeInstance && typeof runtimeNativeInstance === 'object') {
    return runtimeNativeInstance as LayoutBridgeContext
  }

  const stateNativeInstance = context.$state?.[WEVU_NATIVE_INSTANCE_KEY]
  if (stateNativeInstance && typeof stateNativeInstance === 'object') {
    return stateNativeInstance as LayoutBridgeContext
  }

  if (context[WEVU_NATIVE_INSTANCE_KEY] && typeof context[WEVU_NATIVE_INSTANCE_KEY] === 'object') {
    return context[WEVU_NATIVE_INSTANCE_KEY] as LayoutBridgeContext
  }

  return context
}

function resolveHostEntry(entry: unknown) {
  if (typeof entry === 'function') {
    return (entry as () => unknown)()
  }
  if (isRef(entry as Ref<unknown>)) {
    return (entry as Ref<unknown>).value
  }
  return entry
}

function findLayoutHostBinding(bindings: LayoutHostBinding[], key: string) {
  return bindings.find(binding => binding.key === key)
}

function safeSelectComponent(target: LayoutBridgeContext | undefined, selector: string) {
  const selectComponent = target?.selectComponent
  if (typeof selectComponent !== 'function') {
    return null
  }
  try {
    return selectComponent.call(target, selector) ?? null
  }
  catch {
    return null
  }
}

function resolveDeclaredLayoutHostFromRefs(
  binding: LayoutHostBinding,
  context: LayoutBridgeContext,
) {
  if (!binding.refName) {
    return null
  }
  const refMap = getTemplateRefMap(context as any)
  const stateRefs = context.__wevu?.state?.$refs
    ?? context.$state?.$refs
    ?? context.$refs
  const refValue = refMap?.get(binding.refName)?.value
    ?? stateRefs?.[binding.refName]
  if (Array.isArray(refValue)) {
    return refValue[0] ?? null
  }
  return refValue ?? null
}

function createDeclaredLayoutHostBridge(bindings: LayoutHostBinding[], context: LayoutBridgeContext) {
  const nativeContext = resolveNativeLayoutContext(context)
  const bridgeBase = nativeContext && typeof nativeContext === 'object'
    ? Object.create(nativeContext)
    : {}
  return Object.assign(bridgeBase, {
    selectComponent(key: string) {
      const binding = findLayoutHostBinding(bindings, key)
      if (!binding) {
        return null
      }
      if (binding.kind === 'component' || !binding.kind) {
        const cachedHost = resolveDeclaredLayoutHostFromRefs(binding, context)
        if (cachedHost) {
          return cachedHost
        }
        return safeSelectComponent(nativeContext, binding.selector)
          ?? safeSelectComponent(resolveCurrentPageInstance(), binding.selector)
          ?? null
      }
      return null
    },
  })
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
  return (bridgeContext ?? fallbackContext ?? getCurrentInstance()) as LayoutBridgeInstance<T> | undefined
}

/**
 * 解析当前页面 layout 内通过指定 key 暴露的宿主实例。
 */
export function resolveLayoutHost<T = any, C = any>(
  key: string,
  options: LayoutHostResolveOptions<C> = {},
) {
  const context = options.context ?? options.fallbackContext
  const bridge = resolveLayoutBridge<LayoutBridgeContext & C>(key, context as LayoutBridgeContext & C | undefined)
  const host = bridge?.selectComponent?.(key)
  return (host ?? null) as T | null
}

/**
 * 等待当前页面 layout 宿主实例可用，适合页面初次进入时的异步宿主解析。
 */
export function waitForLayoutHost<T = any, C = any>(
  key: string,
  options: LayoutHostResolveOptions<C> = {},
) {
  const retries = options.retries ?? 20
  const interval = options.interval ?? 16
  const host = resolveLayoutHost<T, C>(key, options)
  if (host || retries <= 0) {
    return Promise.resolve(host)
  }
  return new Promise<T | null>((resolve) => {
    setTimeout(() => {
      resolve(waitForLayoutHost<T, C>(key, {
        ...options,
        retries: retries - 1,
      }))
    }, interval)
  })
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

/**
 * 使用编译期注入的宿主绑定信息，直接从当前 layout 运行时实例解析子组件宿主并注册 bridge。
 */
export function registerRuntimeLayoutHosts(
  bindings: LayoutHostBinding[],
  context?: LayoutBridgeContext,
) {
  if (!bindings.length) {
    return null
  }
  const bridgeContext = context ?? getCurrentInstance<LayoutBridgeContext>()
  if (!bridgeContext) {
    return null
  }
  const bridge = createDeclaredLayoutHostBridge(bindings, bridgeContext)
  registerPageLayoutBridge(bindings.map(binding => binding.key), bridge)
  return bridge
}

/**
 * 移除运行时自动注册的 layout 宿主 bridge。
 */
export function unregisterRuntimeLayoutHosts(
  bindings: LayoutHostBinding[],
  context?: LayoutBridgeContext,
) {
  if (!bindings.length) {
    return false
  }
  const bridgeContext = context ?? getCurrentInstance<LayoutBridgeContext>()
  if (!bridgeContext) {
    return false
  }
  return unregisterPageLayoutBridge(
    bindings.map(binding => binding.key),
    bridgeContext,
  )
}

/**
 * 使用 key -> 宿主实例的映射批量暴露 layout 内部宿主，适合 toast/dialog 等共享反馈节点。
 */
export function useLayoutHosts(hosts: LayoutHostMap) {
  const selectors = Object.keys(hosts)
  useLayoutBridge(selectors, {
    resolveComponent(key) {
      return resolveHostEntry(hosts[key])
    },
  })
}
