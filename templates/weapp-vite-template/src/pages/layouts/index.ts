import { setPageLayout } from 'weapp-vite/runtime'

Page({
  data: {
    currentLayout: 'default',
    cards: [
      {
        title: 'default 布局',
        desc: '页面默认命中 src/layouts/default 作为轻量外壳。',
      },
      {
        title: 'admin 布局',
        desc: '调用 setPageLayout("admin", props) 后会切换到命名布局。',
      },
      {
        title: '关闭布局',
        desc: '调用 setPageLayout(false) 可恢复为无布局状态。',
      },
    ],
  },
  onLoad() {
    setPageLayout('default')
  },
  applyDefaultLayout() {
    this.setData({ currentLayout: 'default' })
    setPageLayout('default')
  },
  applyAdminLayout() {
    this.setData({ currentLayout: 'admin' })
    setPageLayout('admin', {
      title: 'Native Console',
      subtitle: '这个标题来自原生 Page 调用 setPageLayout()。',
    })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
  },
  backHome() {
    wx.navigateTo({ url: '/pages/index/index' })
  },
})
