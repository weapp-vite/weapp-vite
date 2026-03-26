Page({
  data: {
    title: 'Content Editor',
    draft: {
      headline: 'Autumn collection',
      summary: 'Narrative-heavy page with setData patches.',
      tags: ['feature', 'hero'],
    },
    logs: [],
  },
  push(message) {
    this.setData({
      logs: [...this.data.logs, message],
    })
  },
  onLoad(query) {
    this.push('editor:onLoad:' + JSON.stringify(query))
  },
  onShow() {
    this.push('editor:onShow')
  },
  onReady() {
    this.push('editor:onReady')
  },
  renameHeadline() {
    this.setData({
      'draft.headline': 'Winter collection',
    }, () => {
      this.push('editor:headline:updated')
    })
  },
  promoteTag() {
    this.setData({
      'draft.tags[0]': 'launch',
    }, () => {
      this.push('editor:tag:launch')
    })
  },
  openLibrary() {
    wx.navigateTo({
      url: '/package-media/library/index?entry=editor',
    })
  },
  openReview() {
    wx.redirectTo({
      url: '/pages/review/index?from=editor',
    })
  },
})
