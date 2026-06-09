import { setPageLayout } from 'weapp-vite/runtime'
import { showLayoutMessage, showLayoutToast } from '../../shared/layoutFeedback'

definePageMeta({
  layout: 'default',
})

Page({
  data: {
    currentLayout: 'default',
    layoutRows: [
      { title: 'default', note: '轻量顶栏 + TDesign 反馈宿主' },
      { title: 'compact', note: '带头图的紧凑布局 + props' },
      { title: 'none', note: '运行时关闭 layout 包裹' },
    ],
  },
  onLoad() {
    setPageLayout('default')
  },
  useDefaultLayout() {
    this.setData({ currentLayout: 'default' })
    setPageLayout('default')
    showLayoutToast(this, {
      message: '已切回 default layout',
      theme: 'success',
    })
  },
  useCompactLayout() {
    this.setData({ currentLayout: 'compact' })
    setPageLayout('compact', {
      title: 'Donut Compact Layout',
      subtitle: '这个标题来自原生 Page 运行时 setPageLayout()。',
    })
    showLayoutMessage(this, {
      message: '已切换到 compact layout',
      theme: 'success',
    })
  },
  closeLayout() {
    this.setData({ currentLayout: 'none' })
    setPageLayout(false)
    wx.showToast({
      title: 'layout 已关闭',
      icon: 'none',
    })
  },
  showToastFromLayout() {
    showLayoutToast(this, {
      message: `当前布局：${this.data.currentLayout}`,
      theme: 'success',
    })
  },
  showMessageFromLayout() {
    showLayoutMessage(this, {
      message: `来自 layout 内 t-message：${this.data.currentLayout}`,
      theme: 'info',
    })
  },
})
