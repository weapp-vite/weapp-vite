const MINI_PROGRAM_GLOBAL_KEYS = ['my', 'wx', 'tt', 'swan', 'jd', 'xhs'] as const
const ROUTE_RUNTIME_GLOBAL_KEYS = ['wx', 'tt', 'my', 'swan', 'jd', 'xhs'] as const
const MINI_PROGRAM_PLATFORM_GLOBAL_KEY_MAP = Object.freeze({
  weapp: 'wx',
  alipay: 'my',
  tt: 'tt',
  swan: 'swan',
  jd: 'jd',
  xhs: 'xhs',
} as const)

export function getMiniProgramGlobalKeys() {
  return [...MINI_PROGRAM_GLOBAL_KEYS]
}

export function getRouteRuntimeGlobalKeys() {
  return [...ROUTE_RUNTIME_GLOBAL_KEYS]
}

export function getMiniProgramPlatformGlobalKey(platform?: string) {
  if (!platform) {
    return undefined
  }
  return MINI_PROGRAM_PLATFORM_GLOBAL_KEY_MAP[platform as keyof typeof MINI_PROGRAM_PLATFORM_GLOBAL_KEY_MAP] ?? platform
}

export function createMiniProgramGlobalResolveExpression(options?: {
  globalKeys?: readonly string[]
  hostExpression?: string
}) {
  const globalKeys = options?.globalKeys ?? getMiniProgramGlobalKeys()
  const hostExpression = options?.hostExpression ?? 'globalThis'
  return `(${globalKeys.map(key => `${hostExpression}.${key}`).join(' ?? ')})`
}
