import type { PageFeatures } from '../../types'

export function resolveComponentFeatures(options: {
  features: PageFeatures
  userOnSaveExitState?: any
  userOnPullDownRefresh?: any
  userOnReachBottom?: any
  userOnPageScroll?: any
  userOnRouteDone?: any
  userOnTabItemTap?: any
  userOnResize?: any
  userOnShareAppMessage?: any
  userOnShareTimeline?: any
  userOnAddToFavorites?: any
}) {
  const {
    features,
    userOnSaveExitState,
    userOnPullDownRefresh,
    userOnReachBottom,
    userOnPageScroll,
    userOnRouteDone,
    userOnTabItemTap,
    userOnResize,
    userOnShareAppMessage,
    userOnShareTimeline,
    userOnAddToFavorites,
  } = options

  const enableOnPullDownRefresh = typeof userOnPullDownRefresh === 'function' || Boolean(features.enableOnPullDownRefresh)
  const enableOnReachBottom = typeof userOnReachBottom === 'function' || Boolean(features.enableOnReachBottom)
  const enableOnPageScroll = typeof userOnPageScroll === 'function' || Boolean(features.enableOnPageScroll)
  const enableOnRouteDone = typeof userOnRouteDone === 'function' || Boolean(features.enableOnRouteDone)
  const enableOnRouteDoneFallback = Boolean(features.enableOnRouteDoneFallback)
  const enableOnTabItemTap = typeof userOnTabItemTap === 'function' || Boolean(features.enableOnTabItemTap)
  const enableOnResize = typeof userOnResize === 'function' || Boolean(features.enableOnResize)
  const enableOnShareTimeline = typeof userOnShareTimeline === 'function' || Boolean(features.enableOnShareTimeline)
  const enableOnShareAppMessage = typeof userOnShareAppMessage === 'function' || Boolean(features.enableOnShareAppMessage)
  const enableOnAddToFavorites = typeof userOnAddToFavorites === 'function' || Boolean(features.enableOnAddToFavorites)
  const enableOnSaveExitState = typeof userOnSaveExitState === 'function' || Boolean(features.enableOnSaveExitState)

  const fallbackNoop = () => {}

  const effectiveOnSaveExitState = (typeof userOnSaveExitState === 'function'
    ? userOnSaveExitState
    : (() => ({ data: undefined })) as any)
  const effectiveOnPullDownRefresh = typeof userOnPullDownRefresh === 'function' ? userOnPullDownRefresh : fallbackNoop
  const effectiveOnReachBottom = typeof userOnReachBottom === 'function' ? userOnReachBottom : fallbackNoop
  const effectiveOnPageScroll = typeof userOnPageScroll === 'function' ? userOnPageScroll : fallbackNoop
  const effectiveOnRouteDone = typeof userOnRouteDone === 'function' ? userOnRouteDone : fallbackNoop
  const effectiveOnTabItemTap = typeof userOnTabItemTap === 'function' ? userOnTabItemTap : fallbackNoop
  const effectiveOnResize = typeof userOnResize === 'function' ? userOnResize : fallbackNoop
  const effectiveOnShareAppMessage = typeof userOnShareAppMessage === 'function' ? userOnShareAppMessage : (fallbackNoop as any)
  const effectiveOnShareTimeline = typeof userOnShareTimeline === 'function' ? userOnShareTimeline : (fallbackNoop as any)
  const effectiveOnAddToFavorites = (typeof userOnAddToFavorites === 'function' ? userOnAddToFavorites : (() => ({})) as any)

  return {
    enableOnPullDownRefresh,
    enableOnReachBottom,
    enableOnPageScroll,
    enableOnRouteDone,
    enableOnRouteDoneFallback,
    enableOnTabItemTap,
    enableOnResize,
    enableOnShareAppMessage,
    enableOnShareTimeline,
    enableOnAddToFavorites,
    enableOnSaveExitState,
    effectiveOnSaveExitState,
    effectiveOnPullDownRefresh,
    effectiveOnReachBottom,
    effectiveOnPageScroll,
    effectiveOnRouteDone,
    effectiveOnTabItemTap,
    effectiveOnResize,
    effectiveOnShareAppMessage,
    effectiveOnShareTimeline,
    effectiveOnAddToFavorites,
  }
}
