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
      value: '基础样式',
    },
    title: {
      type: String,
      value: '默认外壳',
    },
  },
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackHandlers = createLayoutFeedback(this, {
        id: 'default',
        message: {
          content: '默认外壳：顶部轻提示',
          theme: 'info',
          duration: 1600,
        },
        toast: {
          message: '默认布局已响应',
          theme: 'success',
          duration: 1200,
          placement: 'middle',
          direction: 'row',
        },
      })
      registerLayoutFeedback('default', this.__layoutPowerFeedbackHandlers)
    },
    detached(this: LayoutFeedbackComponent) {
      if (this.__layoutPowerFeedbackHandlers) {
        unregisterLayoutFeedback('default', this.__layoutPowerFeedbackHandlers)
        this.__layoutPowerFeedbackHandlers = undefined
      }
    },
  },
})
