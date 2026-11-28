type AcceptanceHost = typeof globalThis & {
  __appPreludeLog__?: string[]
  __appPreludeRuntimeState__?: { fetch: string, url: string }
  __appPreludeMainPageLoads__?: number
  __appPreludeIndependentPageLoads__?: number
}

const host = globalThis as AcceptanceHost

export function markNativePageLoad(scope: 'main' | 'independent') {
  const key = scope === 'main' ? '__appPreludeMainPageLoads__' : '__appPreludeIndependentPageLoads__'
  host[key] = (host[key] ?? 0) + 1
}

export function resolveNativePageLoads() {
  return {
    main: host.__appPreludeMainPageLoads__ ?? 0,
    independent: host.__appPreludeIndependentPageLoads__ ?? 0,
  }
}

export function resolvePreludeRuntimeState() {
  return host.__appPreludeRuntimeState__ ?? { fetch: 'undefined', url: 'undefined' }
}

export function resolvePreludeLog() {
  return getApp<{ getPreludeLog?: () => string[] }>()?.getPreludeLog?.() ?? []
}

export function resolveRequestRuntimeState() {
  return {
    fetch: typeof fetch,
    headers: typeof Headers,
    request: typeof Request,
    response: typeof Response,
    xmlHttpRequest: typeof XMLHttpRequest,
    webSocket: typeof WebSocket,
    url: typeof URL,
    urlSearchParams: typeof URLSearchParams,
    blob: typeof Blob,
    formData: typeof FormData,
  }
}
