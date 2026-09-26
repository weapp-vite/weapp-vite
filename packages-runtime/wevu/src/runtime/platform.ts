import type { MiniProgramRuntimeCapabilityName } from '@weapp-core/shared/platforms/runtime'
import type { MiniProgramGlobal } from './platform/globals'
import { DEFAULT_RUNTIME_HOST_CONFIG_KEY } from '@weapp-core/shared/platforms/runtime'
import { getCurrentMiniProgramGlobalObject, getCurrentMiniProgramRuntimeCapabilities } from './platform/current'
import { getGlobalRuntime } from './platform/globals'

export { getCurrentMiniProgramGlobalObject, getCurrentMiniProgramRuntimeCapabilities, resolveCurrentMiniProgramPlatform } from './platform/current'
export { getMiniProgramGlobalObject } from './platform/generic'

type MiniProgramHostConfig = Record<string, any>
type MiniProgramGlobalRouterMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'
type MiniProgramGlobalRouter = Record<MiniProgramGlobalRouterMethodName, (...args: any[]) => any>
const MINI_PROGRAM_GLOBAL_ROUTER_METHODS: readonly MiniProgramGlobalRouterMethodName[] = ['switchTab', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack']

export function supportsCurrentMiniProgramRuntimeCapability(capabilityName: MiniProgramRuntimeCapabilityName): boolean {
  return getCurrentMiniProgramRuntimeCapabilities()[capabilityName] === true
}

export function getCurrentMiniProgramPages(): Array<Record<string, any>> {
  if (!supportsCurrentMiniProgramRuntimeCapability('globalPageStack')) {
    return []
  }
  const globalRuntime = getGlobalRuntime()
  const miniProgramGlobal = getCurrentMiniProgramGlobalObject()
  const getCurrentPagesFn = miniProgramGlobal?.getCurrentPages
    ?? globalRuntime?.getCurrentPages
    ?? (typeof getCurrentPages !== 'undefined' ? getCurrentPages : undefined)
  if (typeof getCurrentPagesFn !== 'function') {
    return []
  }
  try {
    const pages = getCurrentPagesFn.call(miniProgramGlobal)
    return Array.isArray(pages) ? pages as Array<Record<string, any>> : []
  }
  catch {
    return []
  }
}

export function getCurrentMiniProgramHostConfig(): MiniProgramHostConfig | undefined {
  const globalRuntime = getGlobalRuntime()
  const hostConfigKey = DEFAULT_RUNTIME_HOST_CONFIG_KEY
  const hostConfig = globalRuntime?.[hostConfigKey]
  return hostConfig && typeof hostConfig === 'object' ? hostConfig as MiniProgramHostConfig : undefined
}

export function getMiniProgramRuntimeGlobalObject(): MiniProgramGlobal | undefined {
  return getCurrentMiniProgramGlobalObject() ?? getGlobalRuntime()
}

export function getMiniProgramRuntimeConsoleWarn(): ((message: string) => void) | undefined {
  return getMiniProgramRuntimeGlobalObject()?.console?.warn
}

export function getCurrentMiniProgramGlobalRouter(): MiniProgramGlobalRouter | undefined {
  if (!supportsCurrentMiniProgramRuntimeCapability('globalRouterApi')) {
    return undefined
  }
  const miniProgramGlobal = getCurrentMiniProgramGlobalObject()
  if (!miniProgramGlobal) {
    return undefined
  }
  const routerMethods = Object.create(null) as Partial<MiniProgramGlobalRouter>
  for (const methodName of MINI_PROGRAM_GLOBAL_ROUTER_METHODS) {
    const handler = miniProgramGlobal[methodName]
    if (typeof handler !== 'function') {
      return undefined
    }
    routerMethods[methodName] = (...args: unknown[]) => handler.apply(miniProgramGlobal, args)
  }
  return routerMethods as MiniProgramGlobalRouter
}

/**
 * @description 读取宿主 app 配置中的 tabBar 页面路径（未带前导 `/`）。
 */
export function getCurrentMiniProgramTabBarPagePaths(): string[] {
  const hostConfig = getCurrentMiniProgramHostConfig()
  const tabBar = hostConfig?.tabBar
  if (!tabBar || typeof tabBar !== 'object') {
    return []
  }
  if (!('list' in tabBar) || !Array.isArray(tabBar.list)) {
    return []
  }
  const paths: string[] = []
  for (const item of tabBar.list) {
    if (!item || typeof item !== 'object' || !('pagePath' in item)) {
      continue
    }
    const pagePath = item.pagePath
    if (typeof pagePath !== 'string' || !pagePath) {
      continue
    }
    // 微信开发者工具可能把宿主配置中的页面路径输出为 `.html` 形式，
    // 路由层使用的是不带扩展名的页面路径，读取边界统一归一化。
    paths.push(pagePath.replace(/\.html$/, ''))
  }
  return paths
}

export function getScopedSlotHostGlobalObject(): MiniProgramGlobal | undefined {
  return getCurrentMiniProgramGlobalObject() ?? getGlobalRuntime()
}
