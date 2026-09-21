import type { MiniProgramRuntimeCapabilities, MiniProgramRuntimeCapabilityName } from '@weapp-core/shared/platforms'
import {
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramRuntimeCapabilities,
  getMiniProgramRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKeys,
  getMiniProgramRuntimeHostConfigKey,
  resolveMiniProgramPlatform,
  supportsMiniProgramRuntimeCapability,
} from '@weapp-core/shared/platforms'

type MiniProgramGlobal = Record<string, any>
declare const tt: MiniProgramGlobal | undefined
declare const swan: MiniProgramGlobal | undefined
declare const jd: MiniProgramGlobal | undefined
declare const xhs: MiniProgramGlobal | undefined
type MiniProgramHostConfig = Record<string, any>
type MiniProgramGlobalRouterMethodName = 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo' | 'navigateBack'
type MiniProgramGlobalRouter = Record<MiniProgramGlobalRouterMethodName, (...args: any[]) => any>
type ImportMetaWithEnv = ImportMeta & {
  env?: {
    PLATFORM?: string
  }
}
const MINI_PROGRAM_GLOBAL_ROUTER_METHODS: readonly MiniProgramGlobalRouterMethodName[] = [
  'switchTab',
  'reLaunch',
  'redirectTo',
  'navigateTo',
  'navigateBack',
]

function getGlobalRuntime() {
  if (typeof globalThis === 'undefined') {
    return undefined
  }
  return globalThis as MiniProgramGlobal
}

function getStaticMiniProgramGlobalObject(globalKey: string): MiniProgramGlobal | undefined {
  switch (globalKey) {
    case 'wx':
      return typeof wx !== 'undefined' ? wx as MiniProgramGlobal : undefined
    case 'my':
      return typeof my !== 'undefined' ? my as MiniProgramGlobal : undefined
    case 'tt':
      return typeof tt !== 'undefined' ? tt : undefined
    case 'swan':
      return typeof swan !== 'undefined' ? swan : undefined
    case 'jd':
      return typeof jd !== 'undefined' ? jd : undefined
    case 'xhs':
      return typeof xhs !== 'undefined' ? xhs : undefined
  }
  return undefined
}

function resolveRuntimeGlobalObject(globalKey: string): MiniProgramGlobal | undefined {
  return getGlobalRuntime()?.[globalKey] ?? getStaticMiniProgramGlobalObject(globalKey)
}

export function resolveCurrentMiniProgramPlatform() {
  const compiledPlatform = (import.meta as ImportMetaWithEnv).env?.PLATFORM

  // 优先命中编译期平台分支，便于构建阶段做 dead-code elimination。
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)
  if (resolvedCompiledPlatform) {
    return resolvedCompiledPlatform
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    if (resolveRuntimeGlobalObject(globalKey)) {
      return getMiniProgramPlatformByRuntimeGlobalKey(globalKey)
    }
  }

  return undefined
}

export function getCurrentMiniProgramRuntimeCapabilities(): MiniProgramRuntimeCapabilities {
  return getMiniProgramRuntimeCapabilities(resolveCurrentMiniProgramPlatform())
}

export function supportsCurrentMiniProgramRuntimeCapability(capabilityName: MiniProgramRuntimeCapabilityName): boolean {
  return supportsMiniProgramRuntimeCapability(resolveCurrentMiniProgramPlatform(), capabilityName)
}

export function getMiniProgramGlobalObject(platformInput?: string): MiniProgramGlobal | undefined {
  const compiledPlatform = platformInput ?? (import.meta as ImportMetaWithEnv).env?.PLATFORM
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)

  if (resolvedCompiledPlatform) {
    const globalKey = getMiniProgramRuntimeGlobalKey(resolvedCompiledPlatform)
    return resolveRuntimeGlobalObject(globalKey)
      ?? (resolvedCompiledPlatform === 'tt' ? resolveRuntimeGlobalObject('wx') : undefined)
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    const candidate = resolveRuntimeGlobalObject(globalKey)
    if (candidate) {
      return candidate as MiniProgramGlobal
    }
  }
  return undefined
}

export function getCurrentMiniProgramPages(): Array<Record<string, any>> {
  if (!supportsCurrentMiniProgramRuntimeCapability('globalPageStack')) {
    return []
  }
  const globalRuntime = getGlobalRuntime()
  const miniProgramGlobal = getMiniProgramGlobalObject()
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
  const hostConfigKey = getMiniProgramRuntimeHostConfigKey(resolveCurrentMiniProgramPlatform())
  const hostConfig = globalRuntime?.[hostConfigKey]
  return hostConfig && typeof hostConfig === 'object' ? hostConfig as MiniProgramHostConfig : undefined
}

export function getMiniProgramRuntimeGlobalObject(): MiniProgramGlobal | undefined {
  return getMiniProgramGlobalObject() ?? getGlobalRuntime()
}

export function getMiniProgramRuntimeConsoleWarn(): ((message: string) => void) | undefined {
  return getMiniProgramRuntimeGlobalObject()?.console?.warn
}

export function getCurrentMiniProgramGlobalRouter(): MiniProgramGlobalRouter | undefined {
  if (!supportsCurrentMiniProgramRuntimeCapability('globalRouterApi')) {
    return undefined
  }
  const miniProgramGlobal = getMiniProgramGlobalObject()
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
  return getMiniProgramGlobalObject() ?? getGlobalRuntime()
}
