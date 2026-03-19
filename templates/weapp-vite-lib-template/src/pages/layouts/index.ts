import { setPageLayout } from 'weapp-vite/runtime'

Page({
  data: {
    currentLayout: 'default',
    cards: [
      {
        title: 'default 布局',
        desc: '当前页面首次进入时默认命中 src/layouts/default.vue。',
      },
      {
        title: 'admin 布局',
        desc: '点击按钮后会调用 setPageLayout("admin", props) 切到命名布局。',
      },
      {
        title: '关闭布局',
        desc: '也可以通过 setPageLayout(false) 临时关闭布局壳。',
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
      title: 'Library Console',
      subtitle: '这个标题来自原生 Page 中调用的 setPageLayout()。',
    })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
  },
  backHome() {
    wx.navigateTo({
      url: '/pages/index/index',
    })
  },
})
