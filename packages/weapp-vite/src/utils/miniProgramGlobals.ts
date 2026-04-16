import {
  getMiniProgramRuntimeGlobalKey,
  getMiniProgramRouteRuntimeGlobalKeys as getSharedMiniProgramRouteRuntimeGlobalKeys,
  getMiniProgramRuntimeGlobalKeysByResolvePriority as getSharedMiniProgramRuntimeGlobalKeysByResolvePriority,
  resolveMiniProgramPlatform,
} from '@weapp-core/shared'

export function getMiniProgramGlobalKeys() {
  return [...getSharedMiniProgramRuntimeGlobalKeysByResolvePriority()]
}

export function getRouteRuntimeGlobalKeys() {
  return [...getSharedMiniProgramRouteRuntimeGlobalKeys()]
}

export function getMiniProgramPlatformGlobalKey(platform?: string) {
  if (!platform) {
    return undefined
  }
  const resolvedPlatform = resolveMiniProgramPlatform(platform)
  return resolvedPlatform ? getMiniProgramRuntimeGlobalKey(resolvedPlatform) : platform
}

export function resolveMiniProgramGlobalHostExpression(hostExpression?: string) {
  return hostExpression ?? 'globalThis'
}

export function createMiniProgramGlobalResolveExpression(options?: {
  globalKeys?: readonly string[]
  hostExpression?: string
}) {
  const globalKeys = options?.globalKeys ?? getMiniProgramGlobalKeys()
  const hostExpression = resolveMiniProgramGlobalHostExpression(options?.hostExpression)
  return `(${globalKeys.map(key => `${hostExpression}.${key}`).join(' ?? ')})`
}
