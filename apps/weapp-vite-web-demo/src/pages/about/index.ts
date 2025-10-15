Page({
  data: {
    title: 'web 端运行时示例',
    description: '当前页面由 weapp-vite 编译的 WXML + WXSS 渲染而成，支持生命周期与 wx API。',
    from: 'index',
  },
  onLoad(query: Record<string, string>) {
    if (query?.from) {
      this.setData({ from: query.from })
    }
  },
  goBack() {
    if (typeof wx !== 'undefined' && typeof wx.navigateBack === 'function') {
      void wx.navigateBack()
    }
  },
})
