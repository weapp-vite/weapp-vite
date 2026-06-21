import { resolveNavbarMetrics } from '../navbarMetrics'

Component({
  data: {
    ...resolveNavbarMetrics(),
  },
  properties: {
    mode: {
      type: String,
      value: '区域组合',
    },
    title: {
      type: String,
      value: '分栏外壳',
    },
  },
})
