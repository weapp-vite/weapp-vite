import { formatBytes } from '../../shared/format'
import { createDashboardLabMetrics, createPackageScore } from '../../shared/metrics'
import { createDashboardLabTimeline } from '../../shared/timeline'

const score = createPackageScore(4)

Page({
  data: {
    metrics: createDashboardLabMetrics('quality'),
    timeline: createDashboardLabTimeline('quality'),
    packageSize: formatBytes(score.bytes),
  },
})
