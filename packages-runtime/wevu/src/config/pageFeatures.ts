export interface PageFeatures {
  /**
   * 启用页面滚动事件（注入 `onPageScroll`）。
   */
  enableOnPageScroll?: boolean
  /**
   * 启用下拉刷新事件（注入 `onPullDownRefresh`；仍需在页面配置开启 enablePullDownRefresh）。
   */
  enableOnPullDownRefresh?: boolean
  /**
   * 启用触底事件（注入 `onReachBottom`）。
   */
  enableOnReachBottom?: boolean
  /**
   * 启用路由动画完成事件（注入 `onRouteDone`）。
   */
  enableOnRouteDone?: boolean
  /**
   * 启用 onReady 阶段的 routeDone 兜底补发。
   *
   * 默认关闭：保持与微信小程序平台事件更一致的行为。
   * 仅当个别 IDE/基础库未派发 routeDone 且业务确实依赖该时机时再开启。
   */
  enableOnRouteDoneFallback?: boolean
  /**
   * 启用 Tab 点击事件（注入 `onTabItemTap`）。
   */
  enableOnTabItemTap?: boolean
  /**
   * 启用窗口尺寸变化事件（注入 `onResize`）。
   */
  enableOnResize?: boolean

  /**
   * 启用“转发/分享给朋友”（注入 `onShareAppMessage`，使右上角菜单显示“转发”）。
   */
  enableOnShareAppMessage?: boolean
  /**
   * 启用“分享到朋友圈”（注入 `onShareTimeline`，使右上角菜单显示“分享到朋友圈”）。
   */
  enableOnShareTimeline?: boolean
  /**
   * 启用“收藏”（注入 `onAddToFavorites`）。
   */
  enableOnAddToFavorites?: boolean
  /**
   * 启用“退出状态保存”（注入 `onSaveExitState`）。
   */
  enableOnSaveExitState?: boolean
}
