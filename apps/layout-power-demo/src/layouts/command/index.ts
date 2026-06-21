import { resolveNavbarMetrics } from '../navbarMetrics'

Component({
  data: {
    ...resolveNavbarMetrics(),
  },
  properties: {
    mode: {
      type: String,
      value: '默认',
    },
    title: {
      type: String,
      value: '布局演示',
    },
  },
})
