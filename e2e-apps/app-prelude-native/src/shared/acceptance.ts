export function resolvePreludeLog() {
  return getApp<{ getPreludeLog?: () => string[] }>()?.getPreludeLog?.() ?? []
}

export function resolveRequestRuntimeState() {
  const host = globalThis as typeof globalThis & Record<string, unknown>
  const result: Record<string, string> = {}
  for (const [name, key] of [
    ['fetch', 'fetch'],
    ['headers', 'Headers'],
    ['request', 'Request'],
    ['response', 'Response'],
    ['xmlHttpRequest', 'XMLHttpRequest'],
    ['webSocket', 'WebSocket'],
    ['url', 'URL'],
    ['urlSearchParams', 'URLSearchParams'],
    ['blob', 'Blob'],
    ['formData', 'FormData'],
  ] as const) {
    result[name] = typeof host[key]
  }
  return result
}
