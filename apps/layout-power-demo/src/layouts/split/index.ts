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
      value: '区域组合',
    },
    title: {
      type: String,
      value: '分栏外壳',
    },
  },
  lifetimes: {
    attached(this: LayoutFeedbackComponent) {
      this.__layoutPowerFeedbackBridge = registerLayoutFeedbackHost(
        'split',
        createLayoutFeedbackHost(this, {
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
