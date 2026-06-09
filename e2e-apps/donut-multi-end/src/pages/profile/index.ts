import { showLayoutMessage, showLayoutToast } from '../../shared/layoutFeedback'

Page({
  data: {
    __e2eResult: {
      status: 'ready',
      entry: 'profile',
      from: '',
      edits: 0,
    },
  },
  onLoad(query) {
    this.setData({
      __e2eResult: {
        status: 'loaded',
        entry: 'profile',
        from: query.from || '',
        edits: 0,
      },
    })
  },
  updateProfile() {
    this.setData({
      '__e2eResult.edits': this.data.__e2eResult.edits + 1,
    })
    showLayoutToast(this, {
      message: 'Profile 已更新',
      theme: 'success',
    })
  },
  showProfileMessage() {
    showLayoutMessage(this, {
      message: `Profile 来源：${this.data.__e2eResult.from || 'direct'}`,
      theme: 'info',
    })
  },
  backHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    })
  },
})
