/// <reference types="miniprogram-api-typings" />
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
 * wevu 运行时 API 名称映射。
 */
export const WE_VU_RUNTIME_APIS = {
  createApp: 'createApp',
  createWevuComponent: 'createWevuComponent',
  createWevuScopedSlotComponent: 'createWevuScopedSlotComponent',
  defineComponent: 'defineComponent',
  setWevuDefaults: 'setWevuDefaults',
} as const

/**
 * wevu 运行时 API 名称类型。
 */
export type WevuRuntimeApiName = (typeof WE_VU_RUNTIME_APIS)[keyof typeof WE_VU_RUNTIME_APIS]
