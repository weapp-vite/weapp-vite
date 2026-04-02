import { increaseIssue385AttachCount } from '../../../shared/issue385AttachCounter'

Component({
  options: {
    virtualHost: true,
  },
  data: {
    attachCount: 0,
  },
  lifetimes: {
    attached() {
      this.setData({
        attachCount: increaseIssue385AttachCount(),
      })
    },
  },
})
