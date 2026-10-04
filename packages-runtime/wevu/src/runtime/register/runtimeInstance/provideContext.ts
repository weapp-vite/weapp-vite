import type { InternalRuntimeState, RuntimeApp } from '../../types'
import {
  WEVU_NATIVE_SLOT_CONTEXT_KEY,
  WEVU_NATIVE_SLOT_PARENT_DATASET_KEY,
  WEVU_NATIVE_SLOT_PARENT_EVENT,
  WEVU_PARENT_INSTANCE_KEY,
  WEVU_PROVIDES_KEY,
  WEVU_RUNTIME_APP_KEY,
} from '@weapp-core/constants'
import { isRuntimeLayoutComponentTarget } from '../../layoutComponentMatcher'
import { getCurrentMiniProgramPages } from '../../platform'
import { attachRuntimeLayoutProvideContext, attachRuntimeProvideContext } from '../../provideContext'
import { resolveNativeDeclarationHost, resolveNativeDeclarationParent } from './nativeDeclaration'

type ImportMetaWithEnv = ImportMeta & { env?: { PLATFORM?: string } }

interface NativeSlotParentDetail {
  resolve: (parent: InternalRuntimeState) => void
}

function isLiveProvideHost(target: InternalRuntimeState | undefined): target is InternalRuntimeState {
  return Boolean(target && typeof target === 'object' && target.__wevu && target[WEVU_PROVIDES_KEY])
}

/**
 * 编译后的组件节点与 slot 监听器必须保留原始 this，不能经过 setup 方法代理。
 */
export function receiveNativeSlotParent(this: InternalRuntimeState, event: {
  detail?: NativeSlotParentDetail
  currentTarget?: { dataset?: Record<string, unknown> }
}) {
  const key = event.currentTarget?.dataset?.[WEVU_NATIVE_SLOT_PARENT_DATASET_KEY]
  const parent = typeof key === 'string' ? resolveNativeDeclarationHost(this, key) : this
  if (isLiveProvideHost(parent) && typeof event.detail?.resolve === 'function') {
    event.detail.resolve(parent)
  }
}

function resolveNativeOwner(target: InternalRuntimeState): InternalRuntimeState | undefined {
  const selectOwnerComponent = target.selectOwnerComponent
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
  return undefined
}

function resolveNativeSlotParent(target: InternalRuntimeState): InternalRuntimeState | undefined {
  if (
    (import.meta as ImportMetaWithEnv).env?.PLATFORM
    && (import.meta as ImportMetaWithEnv).env?.PLATFORM !== 'weapp'
  ) {
    return undefined
  }
  if (target[WEVU_NATIVE_SLOT_CONTEXT_KEY] !== true || typeof target.triggerEvent !== 'function') {
    return undefined
  }

  let parent: InternalRuntimeState | undefined
  const detail: NativeSlotParentDetail = {
    resolve(candidate) {
      if (candidate === target || !isLiveProvideHost(candidate) || candidate === parent) {
        return
      }
      if (!parent) {
        parent = candidate
        return
      }
      // 词法声明与原生投影共用同一父链，只向仍存活的更近宿主收敛。
      for (let ancestor = candidate[WEVU_PARENT_INSTANCE_KEY]; ancestor; ancestor = ancestor[WEVU_PARENT_INSTANCE_KEY]) {
        if (ancestor === parent) {
          parent = candidate
          return
        }
      }
    },
  }
  const declarationParent = resolveNativeDeclarationParent(target)
  if (declarationParent) {
    detail.resolve(declarationParent)
  }
  target.triggerEvent(WEVU_NATIVE_SLOT_PARENT_EVENT, detail, { bubbles: true, composed: true })
  return parent
}

function resolveRuntimeParentInstance(
  target: InternalRuntimeState,
  attached: boolean,
  layoutParent?: InternalRuntimeState,
): InternalRuntimeState | undefined {
  if (isRuntimeLayoutComponentTarget(target)) {
    return undefined
  }

  // 生命周期由注册入口显式传入；created 和提前恢复不能假定原生投影已就绪。
  if (attached) {
    const slotParent = resolveNativeSlotParent(target)
    if (slotParent) {
      return slotParent
    }
  }

  const cached = target[WEVU_PARENT_INSTANCE_KEY]
  if (cached && typeof cached === 'object') {
    return cached
  }
  if (layoutParent !== target && isLiveProvideHost(layoutParent)) {
    return layoutParent
  }

  const owner = resolveNativeOwner(target)
  if (owner) {
    return owner
  }

  const pages = getCurrentMiniProgramPages()
  const currentPage = pages[pages.length - 1] as InternalRuntimeState | undefined
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
  if (!isRuntimeLayoutComponentTarget(target)) {
    return
  }
  const pages = getCurrentMiniProgramPages()
  const currentPage = pages[pages.length - 1] as InternalRuntimeState | undefined
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
  attached = false,
  layoutParent?: InternalRuntimeState,
) {
  const parent = resolveRuntimeParentInstance(target, attached, layoutParent)
  target[WEVU_RUNTIME_APP_KEY] = runtimeApp
  attachRuntimeProvideContext(target, runtimeApp, parent)
  attachRuntimeLayoutParentContext(target)
}
