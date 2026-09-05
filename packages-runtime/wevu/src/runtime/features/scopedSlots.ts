import type { WEVU_BINDING_MANIFEST_KEY, WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type {
  LayoutHostBinding,
  RuntimeCapabilityRegistry,
  ScopedSlotMountState,
  TemplateRefBinding,
} from '../capabilities'
import type { InlineExpressionMap } from '../register/inline'
import type { ComputedDefinitions, InternalRuntimeState } from '../types'
import {
  WEVU_PROPS_KEY,
  WEVU_RUNTIME_OWNER_ID_KEY,
  WEVU_SCOPED_SLOT_CREATOR_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'
import {
  getScopedSlotMountState,
  registerRuntimeCapability,
  requireRuntimeCapability,
  RUNTIME_SCOPED_SLOT_STATE_KEY,
} from '../capabilities'
import { createWevuComponent } from '../define'
import { createScopedSlotOptions } from '../define/scopedSlotOptions'
import { getScopedSlotHostGlobalObject } from '../platform'
import { callNativeSetData, resolveNativeSetData } from '../register/runtimeInstance/utils'
import {
  allocateOwnerId,
  attachOwnerSnapshot,
  getOwnerProxy,
  mergeOwnerSnapshotProps,
  removeOwner,
  resolveOwnerSnapshot,
  updateOwnerSnapshot,
} from '../scopedSlots'

export interface CreateWevuScopedSlotComponentOptions {
  computed?: ComputedDefinitions
  inlineMap?: InlineExpressionMap
  layoutHosts?: LayoutHostBinding[]
  templateRefs?: TemplateRefBinding[]
  [WEVU_BINDING_MANIFEST_KEY]?: WevuRuntimeBindingManifestV1
}

type RuntimeTargetWithScopedSlotState = InternalRuntimeState & {
  [RUNTIME_SCOPED_SLOT_STATE_KEY]?: ScopedSlotMountState
  [WEVU_PROPS_KEY]?: unknown
  [WEVU_RUNTIME_OWNER_ID_KEY]?: unknown
  [WEVU_SLOT_OWNER_ID_KEY]?: unknown
}

const scopedSlotHooks: NonNullable<RuntimeCapabilityRegistry['scopedSlots']> = {
  prepareMount(target: InternalRuntimeState) {
    const existing = getScopedSlotMountState(target)
    if (existing) {
      return existing
    }
    const initialNativeOwnerId = target.data?.[WEVU_SLOT_OWNER_ID_KEY]
    const ownerId = typeof initialNativeOwnerId === 'string' && initialNativeOwnerId
      ? initialNativeOwnerId
      : allocateOwnerId()
    const state: ScopedSlotMountState = {
      ownerId,
      shouldFlushNativeOwnerId: typeof initialNativeOwnerId === 'string' && initialNativeOwnerId !== ownerId,
    }
    Object.defineProperty(target, RUNTIME_SCOPED_SLOT_STATE_KEY, {
      value: state,
      configurable: true,
      enumerable: false,
      writable: false,
    })
    return state
  },
  attachMount(target, runtime, state, deferSnapshot) {
    attachOwnerSnapshot(target, runtime, state.ownerId, { deferSnapshot })
  },
  refresh(target: InternalRuntimeState, state: ScopedSlotMountState) {
    const runtime = target.__wevu
    if (!runtime) {
      return
    }
    const snapshot = resolveOwnerSnapshot(runtime)
    const propsSource = (target as RuntimeTargetWithScopedSlotState)[WEVU_PROPS_KEY] ?? target.properties
    mergeOwnerSnapshotProps(snapshot, propsSource)
    updateOwnerSnapshot(state.ownerId, snapshot, runtime.proxy, target)
  },
  syncNativeOwnerId(target: InternalRuntimeState, state: ScopedSlotMountState) {
    if (!state.shouldFlushNativeOwnerId) {
      return
    }
    try {
      if (target.data && typeof target.data === 'object') {
        target.data[WEVU_SLOT_OWNER_ID_KEY] = state.ownerId
      }
    }
    catch {
      // 忽略直接写入失败，后续 setData 仍会尝试同步。
    }
    const setData = resolveNativeSetData(target)
    if (setData) {
      callNativeSetData(target, setData, { [WEVU_SLOT_OWNER_ID_KEY]: state.ownerId })
    }
  },
  teardown(target: InternalRuntimeState) {
    const state = getScopedSlotMountState(target)
    const scopedTarget = target as RuntimeTargetWithScopedSlotState
    const ownerId = state?.ownerId
      ?? scopedTarget[WEVU_RUNTIME_OWNER_ID_KEY]
      ?? scopedTarget[WEVU_SLOT_OWNER_ID_KEY]
    if (typeof ownerId === 'string' && ownerId) {
      removeOwner(ownerId)
    }
    delete scopedTarget[RUNTIME_SCOPED_SLOT_STATE_KEY]
  },
  resolveLifecycleProxy(target: InternalRuntimeState) {
    const scopedTarget = target as RuntimeTargetWithScopedSlotState
    const ownerId = scopedTarget[WEVU_RUNTIME_OWNER_ID_KEY]
      ?? scopedTarget[WEVU_SLOT_OWNER_ID_KEY]
      ?? target.data?.[WEVU_SLOT_OWNER_ID_KEY]
      ?? target.properties?.[WEVU_SLOT_OWNER_ID_KEY]
    return typeof ownerId === 'string' && ownerId ? getOwnerProxy(ownerId) : undefined
  },
  allocateOwnerId,
}

/**
 * 创建编译器生成的作用域插槽组件。
 */
export function createWevuScopedSlotComponent(
  overrides?: CreateWevuScopedSlotComponentOptions,
): void {
  requireRuntimeCapability('scopedSlots', 'createWevuScopedSlotComponent')
  const baseOptions = createScopedSlotOptions(overrides)
  // 作用域插槽选项由内部工厂完整构造，动态常量键会丢失静态索引信息。
  const componentOptions = baseOptions as unknown as Parameters<typeof createWevuComponent>[0]
  createWevuComponent(componentOptions)
}
/**
 * 安装作用域插槽的 owner 生命周期与组件创建能力。
 */
export function installScopedSlots(): void {
  registerRuntimeCapability('scopedSlots', scopedSlotHooks)
  const globalObject = getScopedSlotHostGlobalObject()
  if (globalObject && globalObject[WEVU_SCOPED_SLOT_CREATOR_KEY] !== createWevuScopedSlotComponent) {
    globalObject[WEVU_SCOPED_SLOT_CREATOR_KEY] = createWevuScopedSlotComponent
  }
}
