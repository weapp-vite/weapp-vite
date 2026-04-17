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

export function createMiniProgramTopLevelAccessChecks(options?: {
  globalKeys?: readonly string[]
}) {
  const globalKeys = options?.globalKeys ?? getMiniProgramGlobalKeys()
  return globalKeys.map((key, index) => {
    const prefix = index === 0 ? '((' : ' || ('
    return `${prefix}typeof ${key} !== 'undefined' && ${key})`
  })
}

export function createMiniProgramTopLevelResolveExpression(options?: {
  globalKeys?: readonly string[]
  fallbackExpression?: string
}) {
  const accessChecks = createMiniProgramTopLevelAccessChecks({
    globalKeys: options?.globalKeys,
  })
  return [
    ...accessChecks,
    ` || ${options?.fallbackExpression ?? 'undefined'})`,
  ].join('')
}

export function createMiniProgramGlobalResolveExpression(options?: {
  globalKeys?: readonly string[]
  hostExpression?: string
}) {
  const globalKeys = options?.globalKeys ?? getMiniProgramGlobalKeys()
  const hostExpression = resolveMiniProgramGlobalHostExpression(options?.hostExpression)
  return `(${globalKeys.map(key => `${hostExpression}.${key}`).join(' ?? ')})`
}

export function createMiniProgramHostOrTopLevelResolveExpression(options?: {
  globalKeys?: readonly string[]
  hostExpression?: string
  fallbackExpression?: string
}) {
  const propertyResolveExpression = createMiniProgramGlobalResolveExpression({
    globalKeys: options?.globalKeys,
    hostExpression: options?.hostExpression,
  })
  const topLevelResolveExpression = createMiniProgramTopLevelResolveExpression({
    globalKeys: options?.globalKeys,
    fallbackExpression: options?.fallbackExpression,
  })
  return `(${propertyResolveExpression} ?? ${topLevelResolveExpression})`
}
