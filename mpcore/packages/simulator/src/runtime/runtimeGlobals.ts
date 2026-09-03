const MINI_PROGRAM_UNAVAILABLE_GLOBAL_NAMES = [
  'window',
  'document',
  'navigator',
  'self',
  'global',
  'location',
  'process',
  'Buffer',
  'fetch',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'XMLHttpRequest',
  'WebSocket',
  'URLSearchParams',
  'Blob',
  'File',
  'FormData',
  'btoa',
  'crypto',
  'Event',
  'CustomEvent',
  'localStorage',
  'sessionStorage',
  'setImmediate',
  'structuredClone',
  'queueMicrotask',
] as const

/**
 * 创建不会泄漏 Node.js 或浏览器宿主能力的小程序脚本全局对象。
 * 显式 globals 最后合并，供兼容层和平台差异测试覆盖默认值。
 */
export function createMiniProgramRuntimeGlobals(
  availableGlobals: Record<string, unknown>,
  overrides: Record<string, unknown>,
) {
  const globals: Record<string, unknown> = {}
  for (const name of MINI_PROGRAM_UNAVAILABLE_GLOBAL_NAMES) {
    globals[name] = undefined
  }
  return Object.assign(globals, availableGlobals, overrides)
}
