import type { CreateWevuScopedSlotComponentOptions } from './features/scopedSlots'
import {
  WEVU_INLINE_MAP_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'
import { createApp as createAppCore } from './app'
import { setWevuDefaults as setWevuDefaultsCore } from './defaults'
import {
  createWevuComponent as createWevuComponentCore,
  defineComponent as defineComponentCore,
} from './define'
import { installInlineEvents } from './features/inlineEvents'
import { installLayout } from './features/layout'
import { installPatchStrategy } from './features/patchStrategy'
import {
  createWevuScopedSlotComponent as createWevuScopedSlotComponentCore,
  installScopedSlots,
} from './features/scopedSlots'
import { installSetDataHighFrequencyWarning } from './features/setDataHighFrequencyWarning'
import { installTemplateRefs } from './features/templateRefs'
import {
  mountRuntimeInstance as mountRuntimeInstanceCore,
  registerApp as registerAppCore,
  registerComponent as registerComponentCore,
} from './register'

function installPublicOptionCapabilities(): void {
  installPatchStrategy()
  installSetDataHighFrequencyWarning()
}

function installPublicMetadataCapabilities(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return
  }
  const record = value as Record<string, unknown>
  const directInlineMap = record[WEVU_INLINE_MAP_KEY]
  const methods = record.methods
  const nestedInlineMap = methods && typeof methods === 'object'
    ? (methods as Record<string, unknown>)[WEVU_INLINE_MAP_KEY]
    : undefined
  if (
    (directInlineMap && typeof directInlineMap === 'object' && Object.keys(directInlineMap).length)
    || (nestedInlineMap && typeof nestedInlineMap === 'object' && Object.keys(nestedInlineMap).length)
  ) {
    installInlineEvents()
  }
  const templateRefs = record.__wevuTemplateRefs
  if (Array.isArray(templateRefs) && templateRefs.length) {
    installTemplateRefs()
  }
  const layoutHosts = record.__wevuLayoutHosts
  if (Array.isArray(layoutHosts) && layoutHosts.length) {
    installLayout()
  }
  const setData = record.setData
  const pick = setData && typeof setData === 'object'
    ? (setData as Record<string, unknown>).pick
    : undefined
  if (
    record[WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY] === true
    || record.__wevuHasTemplateRuntimeBindings === true
    || (Array.isArray(pick) && pick.includes(WEVU_SLOT_OWNER_ID_KEY))
  ) {
    installScopedSlots()
  }
}

function installPublicFactoryCapabilities(options: unknown): void {
  installPublicOptionCapabilities()
  installInlineEvents()
  installScopedSlots()
  installPublicMetadataCapabilities(options)
}

export const createApp: typeof createAppCore = (options) => {
  installPublicFactoryCapabilities(options)
  return createAppCore(options)
}

export const defineComponent = ((options: Parameters<typeof defineComponentCore>[0]) => {
  installPublicFactoryCapabilities(options)
  return defineComponentCore(options)
}) as typeof defineComponentCore

export const createWevuComponent: typeof createWevuComponentCore = (options) => {
  installPublicFactoryCapabilities(options)
  return createWevuComponentCore(options)
}

export const registerApp: typeof registerAppCore = (runtimeApp, methods, watch, setup, mpOptions) => {
  installPublicOptionCapabilities()
  installPublicMetadataCapabilities(runtimeApp)
  installPublicMetadataCapabilities(methods)
  installPublicMetadataCapabilities(mpOptions)
  return registerAppCore(runtimeApp, methods, watch, setup, mpOptions)
}

export const registerComponent: typeof registerComponentCore = (
  runtimeApp,
  methods,
  watch,
  setup,
  mpOptions,
  options,
) => {
  installPublicOptionCapabilities()
  installPublicMetadataCapabilities(runtimeApp)
  installPublicMetadataCapabilities(methods)
  installPublicMetadataCapabilities(mpOptions)
  return registerComponentCore(runtimeApp, methods, watch, setup, mpOptions, options)
}

export const mountRuntimeInstance: typeof mountRuntimeInstanceCore = (
  target,
  runtimeApp,
  watch,
  setup,
  options,
) => {
  installPublicOptionCapabilities()
  installPublicMetadataCapabilities(target)
  installPublicMetadataCapabilities(runtimeApp)
  return mountRuntimeInstanceCore(target, runtimeApp, watch, setup, options)
}

export const setWevuDefaults: typeof setWevuDefaultsCore = (defaults) => {
  installPatchStrategy()
  installSetDataHighFrequencyWarning()
  return setWevuDefaultsCore(defaults)
}

/**
 * 创建公开入口的作用域插槽组件，并保留历史上的完整能力行为。
 */
export function createWevuScopedSlotComponent(
  overrides?: CreateWevuScopedSlotComponentOptions,
): void {
  installTemplateRefs()
  installInlineEvents()
  installScopedSlots()
  installLayout()
  createWevuScopedSlotComponentCore(overrides)
}
