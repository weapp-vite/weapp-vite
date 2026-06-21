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
      value: '默认',
    },
    title: {
      type: String,
      value: '布局演示',
    },
  },
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackHandler = createLayoutFeedback(this, {
        id: 'command',
        message: {
          content: '命令外壳：队列已写入',
          theme: 'warning',
          duration: 2200,
          align: 'left',
          closeBtn: true,
        },
        toast: {
          message: '执行 layout:command',
          theme: 'loading',
          duration: 1600,
          placement: 'top',
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
