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
      value: '票据样式',
    },
    title: {
      type: String,
      value: '海报外壳',
    },
  },
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackHandler = createLayoutFeedback(this, {
        id: 'poster',
        message: {
          content: '海报外壳：长文案沿顶部滚动展示',
          theme: 'error',
          duration: 2600,
          marquee: {
            speed: 45,
            loop: 1,
          },
        },
        toast: {
          message: '票据效果已盖章',
          theme: 'error',
          duration: 1700,
          placement: 'bottom',
          direction: 'column',
        },
      })
      registerLayoutFeedback(this.__layoutPowerFeedbackHandler)
    },
    detached(this: LayoutFeedbackComponent) {
      if (this.__layoutPowerFeedbackHandler) {
        unregisterLayoutFeedback(this.__layoutPowerFeedbackHandler)
        this.__layoutPowerFeedbackHandler = undefined
      }
    },
  },
})
