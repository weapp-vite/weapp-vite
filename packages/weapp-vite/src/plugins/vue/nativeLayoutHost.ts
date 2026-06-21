import { createMiniProgramLayoutHostRegistry, resolveMiniProgramPageKeys, resolveMiniProgramPlatform, supportsMiniProgramRuntimeCapability } from '@weapp-core/shared'

export type LayoutHostContext = Record<string, any>
export type LayoutHostResolver = (key: string) => unknown
export type LayoutHostEntry = unknown | (() => unknown)

export interface LayoutHostBridge {
  context?: LayoutHostContext
  keys: string[]
  resolveHost: LayoutHostResolver
}

export interface LayoutHostResolveOptions {
  context?: LayoutHostContext
  interval?: number
  retries?: number
}

type ImportMetaWithEnv = ImportMeta & {
  env?: {
    PLATFORM?: string
  }
}

const layoutHostRegistry = createMiniProgramLayoutHostRegistry<LayoutHostBridge>()

function resolveCurrentPageInstance() {
  const compiledPlatform = resolveMiniProgramPlatform((import.meta as ImportMetaWithEnv).env?.PLATFORM)
  if (!supportsMiniProgramRuntimeCapability(compiledPlatform, 'globalPageStack')) {
    return undefined
  }

  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }

  try {
    const pages = getCurrentPagesFn() as LayoutHostContext[]
    return pages[pages.length - 1]
  }
  catch {
    return undefined
  }
}

function resolvePageKeys(page?: LayoutHostContext) {
  return resolveMiniProgramPageKeys(page)
}

function resolvePageFromContext(context?: LayoutHostContext) {
  return context ?? resolveCurrentPageInstance()
}

function resolveHostEntry(entry: LayoutHostEntry) {
  return typeof entry === 'function' ? (entry as () => unknown)() : entry
}

/**
 * 为当前原生 layout 注册宿主组件，页面可通过 resolveLayoutHost()/waitForLayoutHost() 访问。
 */
export function registerLayoutHosts(
  hosts: Record<string, LayoutHostEntry> | string[],
  context?: LayoutHostContext,
) {
  const keys = Array.isArray(hosts) ? hosts : Object.keys(hosts)
  if (!keys.length) {
    return null
  }

  const page = resolvePageFromContext()
  const pageKeys = resolvePageKeys(page)
  if (pageKeys.length === 0) {
    return null
  }

  const bridge: LayoutHostBridge = {
    context,
    keys,
    resolveHost(key) {
      if (!keys.includes(key)) {
        return null
      }

      if (!Array.isArray(hosts)) {
        return resolveHostEntry(hosts[key]) ?? null
      }

      return context?.selectComponent?.(key) ?? null
    },
  }

  return layoutHostRegistry.register(keys, bridge, pageKeys) ? bridge : null
}

/**
 * 移除当前原生 layout 注册的宿主组件。
 */
export function unregisterLayoutHosts(bridge: LayoutHostBridge | null | undefined) {
  if (!bridge) {
    return false
  }

  return layoutHostRegistry.unregisterBridge(bridge)
}

/**
 * 解析当前页面 layout 内暴露的宿主组件。
 */
export function resolveLayoutHost<T = any>(
  key: string,
  options: LayoutHostResolveOptions = {},
) {
  const page = resolvePageFromContext(options.context)
  return layoutHostRegistry.resolveHost<T>(
    key,
    resolvePageKeys(page),
    (bridge, key) => bridge.resolveHost(key) as T | null,
  )
}

/**
 * 等待当前页面 layout 宿主组件可用。
 */
export function waitForLayoutHost<T = any>(
  key: string,
  options: LayoutHostResolveOptions = {},
): Promise<T | null> {
  return layoutHostRegistry.waitForHost<T>(
    key,
    () => resolvePageKeys(resolvePageFromContext(options.context)),
    (bridge, key) => bridge.resolveHost(key) as T | null,
    options,
  )
}
