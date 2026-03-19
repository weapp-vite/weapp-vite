import Toast from 'tdesign-miniprogram/toast/index'
import { setPageLayout } from 'weapp-vite'

Page({
  data: {
    currentLayout: 'default',
  },
  onLoad() {
    setPageLayout('default')
  },
  applyDefaultLayout() {
    this.setData({ currentLayout: 'default' })
    setPageLayout('default')
    Toast({ context: this, selector: '#t-toast', message: '已切回 default 布局' })
  },
  applyAdminLayout() {
    this.setData({ currentLayout: 'admin' })
    setPageLayout('admin', {
      title: 'TDesign Console',
      subtitle: '这个标题来自原生 Page 调用 setPageLayout()。',
    })
    Toast({ context: this, selector: '#t-toast', message: '已切换到 admin 布局' })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
    Toast({ context: this, selector: '#t-toast', message: '已关闭布局' })
  },
  backHome() {
    wx.navigateTo({ url: '/pages/index/index' })
  },
})
