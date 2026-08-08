import type { WebRuntimeDialogs, WebRuntimeHost } from './types'

let runtimeHost: WebRuntimeHost = {}

export function getWebRuntimeHost(): Readonly<WebRuntimeHost> {
  return runtimeHost
}

export function setWebRuntimeHost(host?: WebRuntimeHost): void {
  runtimeHost = host ? { ...host } : {}
}

export function resetWebRuntimeHost(): void {
  runtimeHost = {}
}

export function getRuntimeFetch() {
  if (typeof runtimeHost.fetch === 'function') {
    return runtimeHost.fetch
  }
  const runtimeGlobal = globalThis as { fetch?: WebRuntimeHost['fetch'] }
  return typeof runtimeGlobal.fetch === 'function' ? runtimeGlobal.fetch : undefined
}

export function getRuntimeStorage() {
  if (runtimeHost.storage) {
    return runtimeHost.storage
  }
  const runtimeGlobal = globalThis as { localStorage?: WebRuntimeHost['storage'] }
  return runtimeGlobal.localStorage
}

export function getRuntimeClipboard() {
  if (runtimeHost.clipboard) {
    return runtimeHost.clipboard
  }
  const runtimeGlobal = globalThis as { navigator?: { clipboard?: WebRuntimeHost['clipboard'] } }
  return runtimeGlobal.navigator?.clipboard
}

export function getRuntimeDialogs() {
  if (runtimeHost.dialogs) {
    return runtimeHost.dialogs
  }
  const runtimeGlobal = globalThis as WebRuntimeDialogs
  return {
    alert: runtimeGlobal.alert,
    confirm: runtimeGlobal.confirm,
    prompt: runtimeGlobal.prompt,
  }
}

export function openRuntimeUrl(url?: string, target?: string, features?: string) {
  if (typeof runtimeHost.open === 'function') {
    if (features === undefined) {
      return runtimeHost.open(url, target)
    }
    return runtimeHost.open(url, target, features)
  }
  const runtimeGlobal = globalThis as {
    open?: WebRuntimeHost['open']
    window?: { open?: WebRuntimeHost['open'] }
  }
  const runtimeOpen = runtimeGlobal.window?.open ?? runtimeGlobal.open
  if (features === undefined) {
    return runtimeOpen?.(url, target)
  }
  return runtimeOpen?.(url, target, features)
}

export type { WebRuntimeClipboard, WebRuntimeDialogs, WebRuntimeHost, WebRuntimeStorage } from './types'
