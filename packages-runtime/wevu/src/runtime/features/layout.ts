import type { RuntimeCapabilityRegistry } from '../capabilities'
import type { InternalRuntimeState } from '../types'
import {
  WEVU_LAYOUT_HOST_BRIDGE_KEY,
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_PAGE_LAYOUT_SETTER_KEY,
} from '@weapp-core/constants'
import { registerRuntimeCapability } from '../capabilities'
import { registerRuntimeLayoutHosts, unregisterRuntimeLayoutHosts } from '../layoutBridge'
import { resolveRuntimePageLayoutName, syncRuntimePageLayoutState } from '../pageLayout'
import { installTemplateRefs } from './templateRefs'

const layoutHooks: NonNullable<RuntimeCapabilityRegistry['layout']> = {
  attachPageSetter(target) {
    target[WEVU_PAGE_LAYOUT_SETTER_KEY] = (layout: string | false, props?: object) => {
      const runtimeState = target.__wevu?.state as Record<string, unknown> | undefined
      if (!runtimeState || typeof runtimeState !== 'object') {
        return
      }
      runtimeState[WEVU_PAGE_LAYOUT_NAME_KEY] = resolveRuntimePageLayoutName(layout)
      const nextProps = layout === false ? {} : (props ?? {})
      runtimeState[WEVU_PAGE_LAYOUT_PROPS_KEY] = nextProps
      syncRuntimePageLayoutState(target as InternalRuntimeState & Record<string, unknown>, layout, nextProps)
    }
  },
  attachHosts(bindings, target) {
    if (!bindings.length || target[WEVU_LAYOUT_HOST_BRIDGE_KEY]) {
      return
    }
    const bridge = registerRuntimeLayoutHosts(bindings, target)
    if (bridge) {
      target[WEVU_LAYOUT_HOST_BRIDGE_KEY] = bridge
    }
  },
  detachHosts(bindings, target) {
    const bridge = target[WEVU_LAYOUT_HOST_BRIDGE_KEY]
    if (!bindings.length || !bridge) {
      return
    }
    unregisterRuntimeLayoutHosts(bindings, bridge)
    delete target[WEVU_LAYOUT_HOST_BRIDGE_KEY]
  },
}

/**
 * 安装 layout 能力，并直接安装其模板 ref 依赖。
 */
export function installLayout(): void {
  installTemplateRefs()
  registerRuntimeCapability('layout', layoutHooks)
}
