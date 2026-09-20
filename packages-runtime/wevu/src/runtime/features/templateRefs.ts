import type { RuntimeCapabilityRegistry, TemplateRefBinding } from '../capabilities'
import type { InternalRuntimeState } from '../types'
import { WEVU_TEMPLATE_REFS_KEY } from '@weapp-core/constants'
import { registerRuntimeCapability } from '../capabilities'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../templateRefs'

const templateRefHooks: NonNullable<RuntimeCapabilityRegistry['templateRefs']> = {
  attachBindings(target: InternalRuntimeState, bindings: readonly TemplateRefBinding[]) {
    Object.defineProperty(target, WEVU_TEMPLATE_REFS_KEY, {
      value: bindings,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  },
  hasBindings(target: InternalRuntimeState) {
    const bindings = target[WEVU_TEMPLATE_REFS_KEY]
    return Array.isArray(bindings) && bindings.length > 0
  },
  schedule: scheduleTemplateRefUpdate,
  scheduleOwner(target: InternalRuntimeState) {
    const selectOwnerComponent = target.selectOwnerComponent
    if (typeof selectOwnerComponent !== 'function') {
      return
    }
    try {
      const owner = selectOwnerComponent.call(target) as InternalRuntimeState | null | undefined
      if (owner && owner !== target) {
        scheduleTemplateRefUpdate(owner)
      }
    }
    catch {
      // 宿主不支持 owner 查询时保持当前组件生命周期正常执行。
    }
  },
  clear: clearTemplateRefs,
}

/**
 * 安装模板 ref 能力。
 */
export function installTemplateRefs(): void {
  registerRuntimeCapability('templateRefs', templateRefHooks)
}
