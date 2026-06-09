import { showLayoutMessage, showLayoutToast } from '../../shared/layoutFeedback'

Page({
  data: {
    lastAction: 'idle',
    capabilityRows: [
      { title: '剪贴板', note: 'wx.setClipboardData' },
      { title: '分享菜单', note: 'wx.showShareMenu' },
      { title: '页面导航', note: 'navigateTo / reLaunch' },
    ],
  },
  copyToken() {
    wx.setClipboardData({
      data: 'donut-multi-end',
      success: () => {
        this.setData({ lastAction: 'clipboard' })
        showLayoutToast(this, {
          message: '标识已复制',
          theme: 'success',
        })
      },
    })
  },
  enableShare() {
    wx.showShareMenu({
      withShareTicket: true,
      complete: () => {
        this.setData({ lastAction: 'share-menu' })
        showLayoutMessage(this, {
          message: '分享菜单状态已更新',
          theme: 'info',
        })
      },
    })
  },
  openProfile() {
    wx.navigateTo({
      url: '/pages/profile/index?from=ability',
    })
  },
  openLayouts() {
    wx.navigateTo({
      url: '/pages/layouts/index',
    })
  },
})
