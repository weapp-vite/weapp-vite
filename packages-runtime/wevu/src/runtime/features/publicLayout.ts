import type { WevuPageLayoutMap } from '../pageLayout'
import type { InternalRuntimeState } from '../types'
import { runtimeCapabilityRegistry } from '../capabilities'
import { getCurrentInstance } from '../hooks'
import {
  registerPageLayoutBridge as registerPageLayoutBridgeImplementation,
  registerRuntimeLayoutHosts as registerRuntimeLayoutHostsImplementation,
  resolveLayoutBridge as resolveLayoutBridgeImplementation,
  resolveLayoutHost as resolveLayoutHostImplementation,
  unregisterPageLayoutBridge as unregisterPageLayoutBridgeImplementation,
  unregisterRuntimeLayoutHosts as unregisterRuntimeLayoutHostsImplementation,
  useLayoutBridge as useLayoutBridgeImplementation,
  useLayoutHosts as useLayoutHostsImplementation,
  waitForLayoutHost as waitForLayoutHostImplementation,
} from '../layoutBridge'
import {
  resolveRuntimePageLayoutName as resolveRuntimePageLayoutNameImplementation,
  setPageLayout as setPageLayoutImplementation,
  syncRuntimePageLayoutStateFromRuntime as syncRuntimePageLayoutStateFromRuntimeImplementation,
  syncRuntimePageLayoutState as syncRuntimePageLayoutStateImplementation,
  usePageLayout as usePageLayoutImplementation,
} from '../pageLayout'
import { getCurrentMiniProgramPages } from '../platform'
import { getCurrentPageInstance } from '../register/component/lifecycle/platform'
import { installLayout } from './layout'

export type { LayoutBridgeInstance, LayoutHostBinding } from '../layoutBridge'
export type { PageLayoutState, WevuPageLayoutMap } from '../pageLayout'

export const registerPageLayoutBridge: typeof registerPageLayoutBridgeImplementation = (...args) => {
  installLayout()
  return registerPageLayoutBridgeImplementation(...args)
}

export const unregisterPageLayoutBridge: typeof unregisterPageLayoutBridgeImplementation = (...args) => {
  installLayout()
  return unregisterPageLayoutBridgeImplementation(...args)
}

export const resolveLayoutBridge: typeof resolveLayoutBridgeImplementation = (...args) => {
  installLayout()
  return resolveLayoutBridgeImplementation(...args)
}

export const resolveLayoutHost: typeof resolveLayoutHostImplementation = (...args) => {
  installLayout()
  return resolveLayoutHostImplementation(...args)
}

export const waitForLayoutHost: typeof waitForLayoutHostImplementation = (...args) => {
  installLayout()
  return waitForLayoutHostImplementation(...args)
}

export const useLayoutBridge: typeof useLayoutBridgeImplementation = (...args) => {
  installLayout()
  return useLayoutBridgeImplementation(...args)
}

export const registerRuntimeLayoutHosts: typeof registerRuntimeLayoutHostsImplementation = (...args) => {
  installLayout()
  return registerRuntimeLayoutHostsImplementation(...args)
}

export const unregisterRuntimeLayoutHosts: typeof unregisterRuntimeLayoutHostsImplementation = (...args) => {
  installLayout()
  return unregisterRuntimeLayoutHostsImplementation(...args)
}

export const useLayoutHosts: typeof useLayoutHostsImplementation = (...args) => {
  installLayout()
  return useLayoutHostsImplementation(...args)
}

export const usePageLayout: typeof usePageLayoutImplementation = (...args) => {
  installLayout()
  return usePageLayoutImplementation(...args)
}

type PublicPageLayoutName = keyof WevuPageLayoutMap extends never
  ? string
  : Extract<keyof WevuPageLayoutMap, string>
type PublicPageLayoutProps<Name extends string> = Name extends keyof WevuPageLayoutMap
  ? WevuPageLayoutMap[Name]
  : object

export function setPageLayout(layout: false): void
export function setPageLayout<Name extends PublicPageLayoutName>(
  layout: Name,
  props?: PublicPageLayoutProps<Name>,
): void
export function setPageLayout(layout: string | false, props?: object): void {
  installLayout()
  const pages = getCurrentMiniProgramPages()
  const currentInstance = getCurrentInstance()
  const currentTarget = currentInstance && typeof currentInstance.route === 'string' && currentInstance.route
    ? currentInstance
    : getCurrentPageInstance() ?? pages[pages.length - 1]
  if (currentTarget) {
    runtimeCapabilityRegistry.layout?.attachPageSetter(currentTarget as InternalRuntimeState)
  }
  if (layout === false) {
    setPageLayoutImplementation(false)
    return
  }
  setPageLayoutImplementation(layout, props)
}

export const syncRuntimePageLayoutState: typeof syncRuntimePageLayoutStateImplementation = (...args) => {
  installLayout()
  return syncRuntimePageLayoutStateImplementation(...args)
}

export const syncRuntimePageLayoutStateFromRuntime: typeof syncRuntimePageLayoutStateFromRuntimeImplementation = (...args) => {
  installLayout()
  return syncRuntimePageLayoutStateFromRuntimeImplementation(...args)
}

export const resolveRuntimePageLayoutName: typeof resolveRuntimePageLayoutNameImplementation = (...args) => {
  installLayout()
  return resolveRuntimePageLayoutNameImplementation(...args)
}
