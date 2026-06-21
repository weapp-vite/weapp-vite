import type { LayoutFeedbackComponent } from '../layoutFeedback'
import {
  createLayoutFeedbackHost,
  registerLayoutFeedbackHost,
  unregisterLayoutFeedbackHost,
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
      this.__layoutPowerFeedbackBridge = registerLayoutFeedbackHost(
        'command',
        createLayoutFeedbackHost(this, {
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
        }),
      )
    },
    detached(this: LayoutFeedbackComponent) {
      if (this.__layoutPowerFeedbackBridge) {
        unregisterLayoutFeedbackHost(this.__layoutPowerFeedbackBridge)
        this.__layoutPowerFeedbackBridge = undefined
      }
    },
  },
})
