import { formatBytes } from '../../shared/format'
import { createDashboardLabMetrics, createPackageScore } from '../../shared/metrics'

const score = createPackageScore(2)

Page({
  data: {
    metrics: createDashboardLabMetrics('analysis'),
    summary: [
      { label: '模块数', value: String(score.modules) },
      { label: '文件数', value: String(score.files) },
      { label: '估算体积', value: formatBytes(score.bytes) },
    ],
  },
})
