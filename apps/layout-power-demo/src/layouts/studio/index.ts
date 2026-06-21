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
      value: '工具面板',
    },
    title: {
      type: String,
      value: '画室外壳',
    },
  },
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackHandlers = createLayoutFeedback(this, {
        id: 'studio',
        message: {
          content: '画室外壳：工具状态已同步',
          theme: 'success',
          duration: 1800,
          align: 'center',
        },
        toast: {
          message: '画板已刷新',
          theme: 'success',
          duration: 1300,
          placement: 'bottom',
          direction: 'column',
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
