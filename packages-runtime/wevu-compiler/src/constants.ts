/// <reference types="miniprogram-api-typings" />
import {
  WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID,
  WEAPP_VITE_RUNTIME_VIRTUAL_ID,
} from '@weapp-core/constants'

export const WE_VU_PAGE_HOOK_TO_FEATURE = {
  onPageScroll: 'enableOnPageScroll',
  onPullDownRefresh: 'enableOnPullDownRefresh',
  onReachBottom: 'enableOnReachBottom',
  onRouteDone: 'enableOnRouteDone',
  onTabItemTap: 'enableOnTabItemTap',
  onResize: 'enableOnResize',
  onShareAppMessage: 'enableOnShareAppMessage',
  onShareTimeline: 'enableOnShareTimeline',
  onAddToFavorites: 'enableOnAddToFavorites',
  onSaveExitState: 'enableOnSaveExitState',
} as const

/**
 * 页面钩子名称。
 */
export type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE
/**
 * 页面特性标识。
 */
export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[WevuPageHookName]

/**
 * wevu 运行时模块 ID。
 */
export const WE_VU_MODULE_ID = 'wevu' as const

/**
 * wevu 编译产物内部运行时模块 ID。
 */
export const WE_VU_INTERNAL_RUNTIME_MODULE_ID = 'wevu/internal-runtime' as const

/**
 * wevu 编译产物内部响应式模块 ID。
 */
export const WE_VU_INTERNAL_REACTIVITY_MODULE_ID = 'wevu/internal-reactivity' as const

/**
 * wevu 编译产物内部模板工具模块 ID。
 */
export const WE_VU_INTERNAL_TEMPLATE_MODULE_ID = 'wevu/internal-template' as const

/**
 * wevu 编译产物使用的稳定运行时虚拟模块 ID。
 */
export const WE_VU_COMPILER_RUNTIME_MODULE_ID = WEAPP_VITE_RUNTIME_VIRTUAL_ID

/**
 * wevu 编译产物使用的稳定响应式虚拟模块 ID。
 */
export const WE_VU_COMPILER_REACTIVITY_MODULE_ID = WEAPP_VITE_RUNTIME_REACTIVITY_VIRTUAL_ID

/**
 * wevu 编译产物使用的稳定模板工具虚拟模块 ID。
 */
export const WE_VU_COMPILER_TEMPLATE_MODULE_ID = WEAPP_VITE_RUNTIME_TEMPLATE_VIRTUAL_ID

/**
 * wevu 运行时模块 ID 列表。
 */
export const WE_VU_RUNTIME_MODULE_IDS = [
  WE_VU_MODULE_ID,
  WE_VU_INTERNAL_RUNTIME_MODULE_ID,
  WE_VU_COMPILER_RUNTIME_MODULE_ID,
  WE_VU_COMPILER_REACTIVITY_MODULE_ID,
  WE_VU_COMPILER_TEMPLATE_MODULE_ID,
] as const

/**
 * 判断模块 ID 是否为 wevu 运行时入口。
 */
export function isWevuRuntimeModuleId(moduleId: string) {
  return (WE_VU_RUNTIME_MODULE_IDS as readonly string[]).includes(moduleId)
}

/**
 * wevu 运行时 API 名称映射。
 */
export const WE_VU_RUNTIME_APIS = {
  createApp: 'createApp',
  createWevuComponent: 'createWevuComponent',
  createWevuScopedSlotComponent: 'createWevuScopedSlotComponent',
  defineAppSetup: 'defineAppSetup',
  defineComponent: 'defineComponent',
  setWevuDefaults: 'setWevuDefaults',
} as const

/**
 * wevu 运行时 API 名称类型。
 */
export type WevuRuntimeApiName = (typeof WE_VU_RUNTIME_APIS)[keyof typeof WE_VU_RUNTIME_APIS]

/**
 * wevu 内部响应式 API 名称。
 */
export const WE_VU_INTERNAL_REACTIVITY_APIS = [
  'addMutationRecorder',
  'batch',
  'computed',
  'customRef',
  'effect',
  'effectScope',
  'endBatch',
  'getCurrentScope',
  'getDeepWatchStrategy',
  'getReactiveVersion',
  'isProxy',
  'isRaw',
  'isReactive',
  'isReadonly',
  'isRef',
  'isShallowReactive',
  'isShallowRef',
  'markRaw',
  'nextTick',
  'onScopeDispose',
  'prelinkReactiveTree',
  'reactive',
  'readonly',
  'ref',
  'removeMutationRecorder',
  'setDeepWatchStrategy',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'startBatch',
  'stop',
  'toRaw',
  'toRef',
  'toRefs',
  'toValue',
  'touchReactive',
  'traverse',
  'triggerRef',
  'unref',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
] as const

/**
 * wevu 内部模板工具 API 名称。
 */
export const WE_VU_INTERNAL_TEMPLATE_APIS = [
  'normalizeClass',
  'normalizeStyle',
  'resolvePropValue',
] as const

const WE_VU_INTERNAL_REACTIVITY_API_SET = new Set<string>(WE_VU_INTERNAL_REACTIVITY_APIS)
const WE_VU_INTERNAL_TEMPLATE_API_SET = new Set<string>(WE_VU_INTERNAL_TEMPLATE_APIS)

/**
 * 根据 wevu API 名称解析编译产物内部导入入口。
 */
export function resolveWevuInternalImportModuleId(apiName: string) {
  if (WE_VU_INTERNAL_REACTIVITY_API_SET.has(apiName)) {
    return WE_VU_COMPILER_REACTIVITY_MODULE_ID
  }
  if (WE_VU_INTERNAL_TEMPLATE_API_SET.has(apiName)) {
    return WE_VU_COMPILER_TEMPLATE_MODULE_ID
  }
  return WE_VU_COMPILER_RUNTIME_MODULE_ID
}
