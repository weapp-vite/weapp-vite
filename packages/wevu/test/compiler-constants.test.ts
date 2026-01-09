import { describe, expect, it } from 'vitest'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE, WE_VU_RUNTIME_APIS } from '@/compiler'

describe('compiler constants', () => {
  it('exports stable module id', () => {
    expect(WE_VU_MODULE_ID).toBe('wevu')
  })

  it('exports runtime api names', () => {
    expect(WE_VU_RUNTIME_APIS).toEqual({
      createApp: 'createApp',
      createWevuComponent: 'createWevuComponent',
      createWevuScopedSlotComponent: 'createWevuScopedSlotComponent',
      defineComponent: 'defineComponent',
      setWevuDefaults: 'setWevuDefaults',
    })
  })

  it('exposes page hook feature mapping', () => {
    expect(WE_VU_PAGE_HOOK_TO_FEATURE).toMatchObject({
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
    })
  })
})
