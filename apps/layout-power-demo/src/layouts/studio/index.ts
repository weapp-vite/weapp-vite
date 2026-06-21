import { resolveNavbarMetrics } from '../navbarMetrics'

Component({
  data: {
    ...resolveNavbarMetrics(),
  },
  properties: {
    mode: {
      type: String,
      value: '工具面板',
    },
    title: {
      type: String,
      value: '画室外壳',
    },
  },
})
