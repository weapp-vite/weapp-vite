import { createDashboardLabMetrics } from '../../shared/metrics'
import { createDashboardLabRoutes } from '../../shared/routes'

Page({
  data: {
    metrics: createDashboardLabMetrics('runtime'),
    routes: createDashboardLabRoutes().slice(0, 2),
  },
})
