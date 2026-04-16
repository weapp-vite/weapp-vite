import type { MiniProgramRuntimeCapabilities, MiniProgramRuntimeCapabilityName } from '@weapp-core/shared'
import {
  getMiniProgramPlatformByRuntimeGlobalKey,
  getMiniProgramRuntimeCapabilities,
  getMiniProgramRuntimeGlobalKey,
  getMiniProgramRuntimeGlobalKeys,
  getMiniProgramRuntimeHostConfigKey,
  resolveMiniProgramPlatform,
  supportsMiniProgramRuntimeCapability,
} from '@weapp-core/shared'

type MiniProgramGlobal = Record<string, any>
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

export function resolveCurrentMiniProgramPlatform() {
  const globalRuntime = getGlobalRuntime()
  const compiledPlatform = (import.meta as ImportMetaWithEnv).env?.PLATFORM

  // 优先命中编译期平台分支，便于构建阶段做 dead-code elimination。
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)
  if (resolvedCompiledPlatform) {
    return resolvedCompiledPlatform
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    if (globalRuntime?.[globalKey]) {
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

export function getCurrentMiniProgramPages(): Array<Record<string, any>> {
  if (!supportsCurrentMiniProgramRuntimeCapability('globalPageStack')) {
    return []
  }
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return []
  }
  try {
    const pages = getCurrentPagesFn()
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

export function getMiniProgramGlobalObject(platformInput?: string): MiniProgramGlobal | undefined {
  const globalRuntime = getGlobalRuntime()
  const compiledPlatform = platformInput ?? (import.meta as ImportMetaWithEnv).env?.PLATFORM
  const resolvedCompiledPlatform = resolveMiniProgramPlatform(compiledPlatform)

  if (resolvedCompiledPlatform) {
    const globalKey = getMiniProgramRuntimeGlobalKey(resolvedCompiledPlatform)
    return globalRuntime?.[globalKey] as MiniProgramGlobal | undefined
  }

  for (const globalKey of getMiniProgramRuntimeGlobalKeys()) {
    const candidate = globalRuntime?.[globalKey]
    if (candidate) {
      return candidate as MiniProgramGlobal
    }
  }
  return undefined
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
    routerMethods[methodName] = (...args: any[]) => handler.apply(miniProgramGlobal, args)
  }
  return routerMethods as MiniProgramGlobalRouter
}

export function getScopedSlotHostGlobalObject(): MiniProgramGlobal | undefined {
  return getMiniProgramGlobalObject() ?? getGlobalRuntime()
}
