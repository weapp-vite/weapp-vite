import type { InternalRuntimeState, RuntimeApp } from '../../types'
import {
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_RUNTIME_APP_KEY,
} from '@weapp-core/constants'
import { getCurrentMiniProgramPages } from '../../platform'
import { attachRuntimeLayoutProvideContext, attachRuntimeProvideContext } from '../../provideContext'

function isRuntimeLayoutTarget(target: InternalRuntimeState): boolean {
  const componentPath = (target as any).is
  return typeof componentPath === 'string' && componentPath.startsWith('layouts/')
}

function resolveRuntimeParentInstance(target: InternalRuntimeState): InternalRuntimeState | undefined {
  if (isRuntimeLayoutTarget(target)) {
    return undefined
  }

  const cached = target[WEVU_PARENT_INSTANCE_KEY]
  if (cached && typeof cached === 'object') {
    return cached
  }

  const selectOwnerComponent = (target as any).selectOwnerComponent
  if (typeof selectOwnerComponent === 'function') {
    try {
      const owner = selectOwnerComponent.call(target) as InternalRuntimeState | undefined
      if (owner && owner !== target && typeof owner === 'object' && owner.__wevu) {
        return owner
      }
    }
    catch {
      // 部分宿主或生命周期阶段可能暂不支持 owner 查询，继续使用页面兜底。
    }
  }

  const currentPage = getCurrentMiniProgramPages().at(-1) as InternalRuntimeState | undefined
  if (
    currentPage
    && currentPage !== target
    && typeof currentPage === 'object'
    && currentPage.__wevu
  ) {
    return currentPage
  }

  return undefined
}

function attachRuntimeLayoutParentContext(target: InternalRuntimeState) {
  if (!isRuntimeLayoutTarget(target)) {
    return
  }
  const currentPage = getCurrentMiniProgramPages().at(-1) as InternalRuntimeState | undefined
  if (
    currentPage
    && currentPage !== target
    && typeof currentPage === 'object'
    && currentPage.__wevu
  ) {
    attachRuntimeLayoutProvideContext(target, currentPage)
  }
}

export function attachRuntimeProvideParentContext(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<any, any, any>,
) {
  target[WEVU_RUNTIME_APP_KEY] = runtimeApp
  attachRuntimeProvideContext(target, runtimeApp, resolveRuntimeParentInstance(target))
  attachRuntimeLayoutParentContext(target)
}
