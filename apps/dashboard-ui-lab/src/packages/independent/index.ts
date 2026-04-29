import { formatBytes } from '../../shared/format'
import { createDashboardLabMetrics, createPackageScore } from '../../shared/metrics'

const score = createPackageScore(8)

Page({
  data: {
    metrics: createDashboardLabMetrics('independent'),
    packageSize: formatBytes(score.bytes),
  },
})
