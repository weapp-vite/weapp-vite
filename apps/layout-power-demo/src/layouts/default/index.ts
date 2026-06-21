import type { LayoutFeedbackComponent } from '../layoutFeedback'
import {
  createLayoutFeedbackHost,
  destroyLayoutFeedbackHost,
  registerLayoutFeedbackHost,
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
      this.__layoutPowerFeedbackBridge = registerLayoutFeedbackHost(
        'default',
        createLayoutFeedbackHost(this, {
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
        }),
      )
    },
    detached(this: LayoutFeedbackComponent) {
      destroyLayoutFeedbackHost(this, this.__layoutPowerFeedbackBridge)
      this.__layoutPowerFeedbackBridge = undefined
    },
  },
})
