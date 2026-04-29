import { createDashboardLabMetrics } from '../../shared/metrics'
import { createDashboardLabRoutes } from '../../shared/routes'
import { createDashboardLabTimeline } from '../../shared/timeline'

Page({
  data: {
    metrics: createDashboardLabMetrics('home'),
    routes: createDashboardLabRoutes(),
    timeline: createDashboardLabTimeline('home'),
  },
  onLoad() {
    wx.preloadSubpackage({
      name: 'packages/quality',
    })
  },
  onNavigate(event: WechatMiniprogram.TouchEvent) {
    const { path } = event.currentTarget.dataset as { path?: string }
    if (path) {
      wx.navigateTo({ url: path })
    }
  },
})
