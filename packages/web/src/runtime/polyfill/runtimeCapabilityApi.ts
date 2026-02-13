import { checkRuntimeCapability } from './capability'
import {
  addNetworkStatusCallback,
  removeNetworkStatusCallback,
} from './network'
import {
  addWindowResizeCallback,
  removeWindowResizeCallback,
} from './windowResize'

export function onNetworkStatusChangeBridge(callback: any) {
  if (typeof callback !== 'function') {
    return
  }
  addNetworkStatusCallback(callback)
}

export function offNetworkStatusChangeBridge(callback?: any) {
  removeNetworkStatusCallback(callback)
}

export function onWindowResizeBridge(callback: any, getWindowInfo: () => any) {
  if (typeof callback !== 'function') {
    return
  }
  addWindowResizeCallback(callback, getWindowInfo)
}

export function offWindowResizeBridge(callback?: any) {
  removeWindowResizeCallback(callback)
}

export function canIUseBridge(wxBridge: Record<string, unknown> | undefined, schema: string) {
  return checkRuntimeCapability(wxBridge, schema)
}
