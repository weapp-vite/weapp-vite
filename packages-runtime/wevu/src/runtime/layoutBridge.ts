import type { Ref } from '../reactivity'
import {
  WEVU_LAYOUT_BRIDGE_PAGE_KEYS,
  WEVU_NATIVE_INSTANCE_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
} from '@weapp-core/constants'
import { isRef } from '../reactivity'
import { getCurrentInstance, getCurrentSetupContext, onAttached, onDetached } from './hooks'
import { getCurrentMiniProgramPages } from './platform'
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

/**
 * @description 对 layout host key 去重并过滤空字符串。
 */
function normalizeLayoutHostKeys(keys: string | string[]) {
  return Array.from(new Set(Array.isArray(keys) ? keys : [keys]))
    .filter((key): key is string => typeof key === 'string' && key.length > 0)
}

/**
 * @description 解析小程序页面实例的稳定身份 key。
 */
function resolvePageIdentityKeys(page?: Record<string, any>): string[] {
  if (!page || typeof page !== 'object') {
    return []
  }

  const keys: string[] = []
  const route = typeof page.route === 'string' ? page.route.replace(/^\/+/, '') : ''
  if (route) {
    keys.push(`route:${route}`)
  }
  for (const [prefix, field] of [
    ['webview', '__wxWebviewId__'],
    ['exparser', '__wxExparserNodeId__'],
  ] as const) {
    const value = page[field]
    if (typeof value === 'number' || typeof value === 'string') {
      keys.push(`${prefix}:${String(value)}`)
    }
  }

  return Array.from(new Set(keys))
}

/**
 * @description 创建小程序 layout host 注册表。
 */
function createLayoutHostRegistry<TBridge>() {
  const registries = new Map<string, Map<string, TBridge>>()

  function register(keys: string | string[], bridge: TBridge, pageKeys: string[]) {
    const normalizedKeys = normalizeLayoutHostKeys(keys)
    if (normalizedKeys.length === 0 || pageKeys.length === 0) {
      return null
    }

    for (const pageKey of pageKeys) {
      const registry = registries.get(pageKey) ?? new Map<string, TBridge>()
      for (const key of normalizedKeys) {
        registry.set(key, bridge)
      }
      registries.set(pageKey, registry)
    }

    return normalizedKeys
  }

  function unregister(keys: string | string[], bridge: TBridge, pageKeys: string[]) {
    const normalizedKeys = normalizeLayoutHostKeys(keys)
    if (normalizedKeys.length === 0 || pageKeys.length === 0) {
      return false
    }

    let removed = false
    for (const pageKey of pageKeys) {
      const registry = registries.get(pageKey)
      if (!registry) {
        continue
      }

      for (const key of normalizedKeys) {
        if (registry.get(key) === bridge) {
          registry.delete(key)
          removed = true
        }
      }

      if (registry.size === 0) {
        registries.delete(pageKey)
      }
    }

    return removed
  }

  function resolveBridge(key: string, pageKeys: string[]) {
    return pageKeys
      .map(pageKey => registries.get(pageKey)?.get(key))
      .find(Boolean)
  }

  function resolveHost<THost>(
    key: string,
    pageKeys: string[],
    resolver: (bridge: TBridge, key: string) => THost | null | undefined,
  ) {
    const bridge = resolveBridge(key, pageKeys)
    if (!bridge) {
      return null
    }
    return resolver(bridge, key) ?? null
  }

  function waitForHost<THost>(
    key: string,
    resolvePageKeys: () => string[],
    resolver: (bridge: TBridge, key: string) => THost | null | undefined,
    options: { interval?: number, retries?: number } = {},
  ): Promise<THost | null> {
    const retries = options.retries ?? 20
    const interval = options.interval ?? 16
    const host = resolveHost(key, resolvePageKeys(), resolver)
    if (host || retries <= 0) {
      return Promise.resolve(host)
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(waitForHost(key, resolvePageKeys, resolver, {
          ...options,
          retries: retries - 1,
        }))
      }, interval)
    })
  }

  return {
    register,
    resolveBridge,
    resolveHost,
    unregister,
    waitForHost,
  }
}

const pageLayoutBridgeRegistry = createLayoutHostRegistry<LayoutBridgeContext>()

function resolveCurrentPageInstance() {
  const pages = getCurrentMiniProgramPages()
  return pages[pages.length - 1]
}

function resolvePageKeys(page?: LayoutBridgeContext) {
  return resolvePageIdentityKeys(page as Record<string, any> | undefined)
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

  const runtimeNativeInstance = context[WEVU_PUBLIC_RUNTIME_KEY]?.state?.[WEVU_NATIVE_INSTANCE_KEY]
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
  const stateRefs = context[WEVU_PUBLIC_RUNTIME_KEY]?.state?.$refs
    ?? context.__wevu?.state?.$refs
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

  const normalizedSelectors = pageLayoutBridgeRegistry.register(selectors, bridgeContext, pageKeys)
  if (!normalizedSelectors) {
    return false
  }

  bridgeContext[WEVU_LAYOUT_BRIDGE_PAGE_KEYS] = pageKeys
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
  const pageKeys = bridgeContext?.[WEVU_LAYOUT_BRIDGE_PAGE_KEYS] ?? resolvePageKeys(page)
  if (!bridgeContext || !Array.isArray(pageKeys) || pageKeys.length === 0) {
    return false
  }

  const removed = pageLayoutBridgeRegistry.unregister(selectors, bridgeContext, pageKeys)
  delete bridgeContext[WEVU_LAYOUT_BRIDGE_PAGE_KEYS]
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
  const bridgeContext = pageLayoutBridgeRegistry.resolveBridge(selector, resolvePageKeys(page))
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
  const page = resolveCurrentPageInstance() ?? resolvePageFromContext(context as LayoutBridgeContext | undefined)
  return pageLayoutBridgeRegistry.resolveHost<T>(
    key,
    resolvePageKeys(page),
    (bridge, key) => bridge.selectComponent?.(key) as T | null,
  )
}

/**
 * 等待当前页面 layout 宿主实例可用，适合页面初次进入时的异步宿主解析。
 */
export function waitForLayoutHost<T = any, C = any>(
  key: string,
  options: LayoutHostResolveOptions<C> = {},
) {
  const context = options.context ?? options.fallbackContext
  return pageLayoutBridgeRegistry.waitForHost<T>(
    key,
    () => resolvePageKeys(resolveCurrentPageInstance() ?? resolvePageFromContext(context as LayoutBridgeContext | undefined)),
    (bridge, key) => bridge.selectComponent?.(key) as T | null,
    options,
  )
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
  const normalizedSelectors = normalizeLayoutHostKeys(selectors)
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
