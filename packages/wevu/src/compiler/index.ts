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

export type WevuPageHookName = keyof typeof WE_VU_PAGE_HOOK_TO_FEATURE
export type WevuPageFeatureFlag = (typeof WE_VU_PAGE_HOOK_TO_FEATURE)[WevuPageHookName]

export const WE_VU_MODULE_ID = 'wevu' as const

export const WE_VU_RUNTIME_APIS = {
  createApp: 'createApp',
  createWevuComponent: 'createWevuComponent',
  createWevuScopedSlotComponent: 'createWevuScopedSlotComponent',
  defineComponent: 'defineComponent',
  setWevuDefaults: 'setWevuDefaults',
} as const

export type WevuRuntimeApiName = (typeof WE_VU_RUNTIME_APIS)[keyof typeof WE_VU_RUNTIME_APIS]
