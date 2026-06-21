import { resolveNavbarMetrics } from '../navbarMetrics'

Component({
  data: {
    ...resolveNavbarMetrics(),
  },
  properties: {
    mode: {
      type: String,
      value: '票据样式',
    },
    title: {
      type: String,
      value: '海报外壳',
    },
  },
})
