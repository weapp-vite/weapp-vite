import { setPageLayout } from 'weapp-vite'

Page({
  data: {
    currentLayout: 'default',
    cards: [
      { title: 'default 布局', desc: '当前页面默认命中 src/layouts/default。' },
      { title: 'admin 布局', desc: '通过 setPageLayout("admin", props) 切换到命名布局。' },
      { title: '关闭布局', desc: '通过 setPageLayout(false) 移除当前页面壳。' },
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
      title: 'Tailwind Console',
      subtitle: '这个标题来自原生 Page 调用 setPageLayout()。',
    })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
  },
  backHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },
})
