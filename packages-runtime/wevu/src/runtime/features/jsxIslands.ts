import type { RuntimeCapabilityRegistry } from '../capabilities'
import type { InternalRuntimeState } from '../types'
import { WEVU_JSX_ISLAND_HANDLER } from '@weapp-core/constants'
import { registerRuntimeCapability } from '../capabilities'
import { runJsxIslandHandler } from '../jsxIsland'

const jsxIslandHooks: NonNullable<RuntimeCapabilityRegistry['jsxIslands']> = {
  attachMethods(methods) {
    if (!methods[WEVU_JSX_ISLAND_HANDLER]) {
      methods[WEVU_JSX_ISLAND_HANDLER] = function (this: InternalRuntimeState, event: unknown) {
        return runJsxIslandHandler(this, event)
      }
    }
  },
}

/**
 * 安装 JSX 动态岛的宿主事件入口，纯模板组件无需携带分发实现。
 */
export function installJsxIslands(): void {
  registerRuntimeCapability('jsxIslands', jsxIslandHooks)
}
