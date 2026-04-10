import Dialog from '@vant/weapp/dialog/dialog'
import { setPageLayout } from 'weapp-vite/runtime'
import { wpi } from 'wevu/api'

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
  },
  applyAdminLayout() {
    this.setData({ currentLayout: 'admin' })
    setPageLayout('admin', {
      title: 'Vant Console',
      subtitle: '这个标题来自原生 Page 调用 setPageLayout()。',
    })
  },
  clearLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
  },
  showState() {
    Dialog.alert({
      title: '当前布局',
      message: `当前状态：${this.data.currentLayout}`,
    })
  },
  async backHome() {
    await wpi.navigateTo({ url: '/pages/index/index' })
  },
})
