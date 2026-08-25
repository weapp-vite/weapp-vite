const plugin = requirePlugin('hello')

Page({
  data: {
    answer: plugin.answer,
  },
  openPluginPage() {
    wx.navigateTo({ url: 'plugin://hello/hello-page' })
  },
})
