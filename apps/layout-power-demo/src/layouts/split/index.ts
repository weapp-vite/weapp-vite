import type { LayoutFeedbackComponent } from '../layoutFeedback'
import {
  createLayoutFeedback,

  registerLayoutFeedback,
  unregisterLayoutFeedback,
} from '../layoutFeedback'
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
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackHandlers = createLayoutFeedback(this, {
        id: 'split',
        message: {
          content: '分栏外壳：区域提示保留 2 秒',
          theme: 'warning',
          duration: 2000,
          align: 'left',
          closeBtn: true,
        },
        toast: {
          message: '右侧区域已定位',
          theme: 'warning',
          duration: 1500,
          placement: 'middle',
          direction: 'row',
        },
      })
      registerLayoutFeedback(this.__layoutPowerFeedbackHandlers)
    },
    detached(this: LayoutFeedbackComponent) {
      if (this.__layoutPowerFeedbackHandlers) {
        unregisterLayoutFeedback(this.__layoutPowerFeedbackHandlers)
        this.__layoutPowerFeedbackHandlers = undefined
      }
    },
  },
})
